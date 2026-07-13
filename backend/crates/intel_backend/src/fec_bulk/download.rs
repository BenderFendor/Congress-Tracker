//! Streaming, content-addressed FEC archive downloads.

use chrono::{DateTime, Utc};
use reqwest::header::{CONTENT_LENGTH, ETAG, LAST_MODIFIED};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tracing::info;

const USER_AGENT: &str = "CongressTracker/0.1 public-interest research";
const DEFAULT_FREE_SPACE_RESERVE: u64 = 5 * 1024 * 1024 * 1024;

#[derive(Debug, Clone)]
pub struct RemoteArchive {
    pub content_length: Option<u64>,
    pub etag: Option<String>,
    pub last_modified: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct DownloadedArchive {
    pub path: PathBuf,
    pub sha256: String,
    pub compressed_bytes: u64,
}

/// Read authoritative HTTP metadata without downloading the archive body.
pub async fn probe_archive(url: &str) -> Result<RemoteArchive, DownloadError> {
    let response = reqwest::Client::new()
        .head(url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await
        .map_err(|source| DownloadError::Http {
            context: format!("probing {url}"),
            source,
        })?;
    if !response.status().is_success() {
        return Err(DownloadError::HttpStatus {
            url: url.to_string(),
            status: response.status().as_u16(),
        });
    }
    let headers = response.headers();
    let content_length = headers
        .get(CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse().ok());
    let etag = headers
        .get(ETAG)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let last_modified = headers
        .get(LAST_MODIFIED)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| DateTime::parse_from_rfc2822(value).ok())
        .map(|value| value.with_timezone(&Utc));

    Ok(RemoteArchive {
        content_length,
        etag,
        last_modified,
    })
}

/// Stream an archive to disk, hash it incrementally, then preserve it by hash.
pub async fn download_content_addressed(
    url: &str,
    storage_root: &Path,
    cycle: u32,
    dataset_name: &str,
    remote: &RemoteArchive,
) -> Result<DownloadedArchive, DownloadError> {
    download_content_addressed_as(url, storage_root, cycle, dataset_name, remote, "zip").await
}

/// Stream a non-ZIP FEC bulk payload while preserving its real extension.
pub async fn download_content_addressed_as(
    url: &str,
    storage_root: &Path,
    cycle: u32,
    dataset_name: &str,
    remote: &RemoteArchive,
    extension: &str,
) -> Result<DownloadedArchive, DownloadError> {
    let temp_dir = storage_root.join("tmp");
    fs::create_dir_all(&temp_dir)
        .await
        .map_err(|source| DownloadError::Io {
            context: format!("creating {}", temp_dir.display()),
            source,
        })?;
    ensure_free_space(storage_root, remote.content_length)?;

    // Keep one deterministic partial file per dataset so a watchdog timeout
    // can resume a multi-gigabyte archive with HTTP Range instead of starting
    // from byte zero.
    let temp_path = temp_dir.join(format!("{dataset_name}.part"));
    let mut existing_bytes = fs::metadata(&temp_path)
        .await
        .ok()
        .map_or(0, |metadata| metadata.len());
    let client = reqwest::Client::new();
    let mut request = client
        .get(url)
        .header(reqwest::header::USER_AGENT, USER_AGENT);
    if existing_bytes > 0 {
        request = request.header(reqwest::header::RANGE, format!("bytes={existing_bytes}-"));
    }
    let mut response = request.send().await.map_err(|source| DownloadError::Http {
        context: format!("downloading {url}"),
        source,
    })?;
    if response.status() == reqwest::StatusCode::RANGE_NOT_SATISFIABLE && existing_bytes > 0 {
        // A changed upstream archive can invalidate a partial range. Restart
        // that one dataset rather than leaving the job permanently failed.
        existing_bytes = 0;
        response = client
            .get(url)
            .header(reqwest::header::USER_AGENT, USER_AGENT)
            .send()
            .await
            .map_err(|source| DownloadError::Http {
                context: format!("restarting download {url}"),
                source,
            })?;
    }
    if !response.status().is_success() {
        return Err(DownloadError::HttpStatus {
            url: url.to_string(),
            status: response.status().as_u16(),
        });
    }

    let append = existing_bytes > 0 && response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
    let mut hasher = Sha256::new();
    let mut compressed_bytes = if append { existing_bytes } else { 0 };
    if append {
        let mut existing =
            fs::File::open(&temp_path)
                .await
                .map_err(|source| DownloadError::Io {
                    context: format!("opening partial {}", temp_path.display()),
                    source,
                })?;
        let mut buffer = vec![0u8; 1024 * 1024];
        loop {
            let read = existing
                .read(&mut buffer)
                .await
                .map_err(|source| DownloadError::Io {
                    context: format!("hashing partial {}", temp_path.display()),
                    source,
                })?;
            if read == 0 {
                break;
            }
            hasher.update(&buffer[..read]);
        }
    }
    let mut output = if append {
        fs::OpenOptions::new().append(true).open(&temp_path).await
    } else {
        fs::File::create(&temp_path).await
    }
    .map_err(|source| DownloadError::Io {
        context: format!("opening {}", temp_path.display()),
        source,
    })?;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|source| DownloadError::Http {
            context: format!("streaming {url}"),
            source,
        })?
    {
        output
            .write_all(&chunk)
            .await
            .map_err(|source| DownloadError::Io {
                context: format!("writing {}", temp_path.display()),
                source,
            })?;
        hasher.update(&chunk);
        compressed_bytes += chunk.len() as u64;
    }
    output.flush().await.map_err(|source| DownloadError::Io {
        context: format!("flushing {}", temp_path.display()),
        source,
    })?;
    drop(output);

    if let Some(expected) = remote.content_length {
        if expected != compressed_bytes {
            return Err(DownloadError::LengthMismatch {
                url: url.to_string(),
                expected,
                actual: compressed_bytes,
            });
        }
    }

    let sha256 = hex::encode(hasher.finalize());
    let archive_dir = storage_root
        .join("raw")
        .join(cycle.to_string())
        .join(dataset_name);
    fs::create_dir_all(&archive_dir)
        .await
        .map_err(|source| DownloadError::Io {
            context: format!("creating {}", archive_dir.display()),
            source,
        })?;
    let archive_path = archive_dir.join(format!("{sha256}.{extension}"));
    if archive_path.exists() {
        fs::remove_file(&temp_path)
            .await
            .map_err(|source| DownloadError::Io {
                context: format!("removing duplicate {}", temp_path.display()),
                source,
            })?;
    } else {
        fs::rename(&temp_path, &archive_path)
            .await
            .map_err(|source| DownloadError::Io {
                context: format!(
                    "renaming {} to {}",
                    temp_path.display(),
                    archive_path.display()
                ),
                source,
            })?;
    }

    info!(
        dataset = dataset_name,
        path = %archive_path.display(),
        compressed_bytes,
        sha256,
        "FEC archive stored"
    );
    Ok(DownloadedArchive {
        path: archive_path,
        sha256,
        compressed_bytes,
    })
}

fn ensure_free_space(root: &Path, content_length: Option<u64>) -> Result<(), DownloadError> {
    let Some(required) = content_length else {
        return Ok(());
    };
    let reserve = std::env::var("FEC_MIN_FREE_BYTES")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(DEFAULT_FREE_SPACE_RESERVE);
    let available = fs2::available_space(root).map_err(|source| DownloadError::Io {
        context: format!("checking free space at {}", root.display()),
        source,
    })?;
    if available < required.saturating_add(reserve) {
        return Err(DownloadError::InsufficientSpace {
            path: root.to_path_buf(),
            required,
            reserve,
            available,
        });
    }
    Ok(())
}

/// Compute SHA-256 without buffering the file in memory.
pub async fn sha256_of(path: &Path) -> Result<String, DownloadError> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || hash_file(&path))
        .await
        .map_err(|source| DownloadError::Join(source.to_string()))?
}

fn hash_file(path: &Path) -> Result<String, DownloadError> {
    use std::io::Read;

    let mut file = std::fs::File::open(path).map_err(|source| DownloadError::Io {
        context: format!("opening {}", path.display()),
        source,
    })?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(|source| DownloadError::Io {
            context: format!("reading {}", path.display()),
            source,
        })?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex::encode(hasher.finalize()))
}

#[derive(Debug, thiserror::Error)]
pub enum DownloadError {
    #[error("HTTP error: {context}: {source}")]
    Http {
        context: String,
        #[source]
        source: reqwest::Error,
    },
    #[error("HTTP {status} for {url}")]
    HttpStatus { url: String, status: u16 },
    #[error("I/O error {context}: {source}")]
    Io {
        context: String,
        #[source]
        source: std::io::Error,
    },
    #[error("download length mismatch for {url}: expected {expected}, received {actual}")]
    LengthMismatch {
        url: String,
        expected: u64,
        actual: u64,
    },
    #[error(
        "insufficient storage at {path:?}: {available} bytes free, {required} required plus {reserve} reserve"
    )]
    InsufficientSpace {
        path: PathBuf,
        required: u64,
        reserve: u64,
        available: u64,
    },
    #[error("background hash task failed: {0}")]
    Join(String),
}
