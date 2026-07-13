//! Bounded-memory readers for large FEC ZIP entries.

use crate::fec_bulk::parse::ParseError;
use std::io::BufRead;
use std::path::PathBuf;
use tokio::sync::mpsc;

/// One bounded parser batch plus malformed-row evidence since the prior batch.
#[derive(Debug)]
pub struct ParsedBatch<T> {
    pub rows: Vec<T>,
    pub seen: usize,
    pub filtered: usize,
    pub skipped: usize,
}

/// Spawn a blocking ZIP reader and expose bounded parsed batches to async callers.
pub fn spawn_zip_batches<T, Parse, Include>(
    path: PathBuf,
    entry_names: Vec<String>,
    batch_size: usize,
    has_header: bool,
    parse_line: Parse,
    include: Include,
) -> mpsc::Receiver<Result<ParsedBatch<T>, ParseError>>
where
    T: Send + 'static,
    Parse: Fn(&str) -> Option<T> + Send + 'static,
    Include: Fn(&T) -> bool + Send + 'static,
{
    let (sender, receiver) = mpsc::channel(2);
    std::thread::spawn(move || {
        if let Err(error) = read_zip_batches(
            &path,
            &entry_names,
            batch_size.max(1),
            has_header,
            parse_line,
            include,
            &sender,
        ) {
            let _ = sender.blocking_send(Err(error));
        }
    });
    receiver
}

fn read_zip_batches<T, Parse, Include>(
    path: &PathBuf,
    entry_names: &[String],
    batch_size: usize,
    has_header: bool,
    parse_line: Parse,
    include: Include,
    sender: &mpsc::Sender<Result<ParsedBatch<T>, ParseError>>,
) -> Result<(), ParseError>
where
    T: Send + 'static,
    Parse: Fn(&str) -> Option<T>,
    Include: Fn(&T) -> bool,
{
    let file = std::fs::File::open(path).map_err(|source| ParseError::Io {
        context: format!("opening {}", path.display()),
        source,
    })?;
    let mut archive = zip::ZipArchive::new(file).map_err(|source| ParseError::Zip {
        context: format!("opening {}", path.display()),
        source,
    })?;
    let available: Vec<String> = archive.file_names().map(str::to_string).collect();
    let actual_name = entry_names
        .iter()
        .find_map(|candidate| {
            available
                .iter()
                .find(|available_name| available_name.eq_ignore_ascii_case(candidate))
        })
        .cloned()
        .ok_or_else(|| ParseError::EntryNotFound {
            entry: entry_names.join(" or "),
            available,
        })?;
    let entry = archive
        .by_name(&actual_name)
        .map_err(|source| ParseError::Zip {
            context: format!("reading entry {actual_name}"),
            source,
        })?;
    let mut reader = std::io::BufReader::new(entry);
    let mut line = String::new();
    let mut line_number = 0usize;
    let mut rows = Vec::with_capacity(batch_size);
    let mut seen = 0usize;
    let mut filtered = 0usize;
    let mut skipped = 0usize;

    loop {
        line.clear();
        let bytes = reader
            .read_line(&mut line)
            .map_err(|source| ParseError::Io {
                context: format!("reading entry {actual_name}"),
                source,
            })?;
        if bytes == 0 {
            break;
        }
        line_number += 1;
        let source_line = line.trim_end_matches(['\r', '\n']);
        if source_line.is_empty() || (has_header && line_number == 1) {
            continue;
        }
        seen += 1;

        match parse_line(source_line) {
            Some(row) if include(&row) => rows.push(row),
            Some(_) => filtered += 1,
            None => skipped += 1,
        }

        if rows.len() == batch_size {
            let batch = ParsedBatch {
                rows: std::mem::replace(&mut rows, Vec::with_capacity(batch_size)),
                seen: std::mem::take(&mut seen),
                filtered: std::mem::take(&mut filtered),
                skipped: std::mem::take(&mut skipped),
            };
            if sender.blocking_send(Ok(batch)).is_err() {
                return Ok(());
            }
        }
    }

    if !rows.is_empty() || seen > 0 || skipped > 0 {
        let _ = sender.blocking_send(Ok(ParsedBatch {
            rows,
            seen,
            filtered,
            skipped,
        }));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[tokio::test]
    async fn streams_zip_entry_in_bounded_batches() {
        let path = std::env::temp_dir().join(format!("fec-stream-{}.zip", uuid::Uuid::new_v4()));
        let file = std::fs::File::create(&path).expect("create test ZIP");
        let mut writer = zip::ZipWriter::new(file);
        writer
            .start_file("VALUES.TXT", zip::write::SimpleFileOptions::default())
            .expect("start ZIP entry");
        writer
            .write_all(b"VALUE\n1\n2\n3\n4\n5\n")
            .expect("write ZIP entry");
        writer.finish().expect("finish ZIP");

        let mut receiver = spawn_zip_batches(
            path.clone(),
            vec!["values.txt".to_string()],
            2,
            true,
            |line| line.parse::<u32>().ok(),
            |_| true,
        );
        let mut sizes = Vec::new();
        let mut values = Vec::new();
        while let Some(batch) = receiver.recv().await {
            let batch = batch.expect("stream batch");
            sizes.push(batch.rows.len());
            values.extend(batch.rows);
        }

        std::fs::remove_file(path).expect("remove test ZIP");
        assert_eq!(sizes, vec![2, 2, 1]);
        assert_eq!(values, vec![1, 2, 3, 4, 5]);
    }
}
