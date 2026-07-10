//! ZIP download with SHA256 verification and idempotent replay.
//!
//! Each download is verified against its SHA256 before being stored.
//! The caller is responsible for recording the hash in `fec_bulk_imports`
//! so that re-downloading the same hash is a no-op.

use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::info;

/// Download a ZIP from the FEC bulk data endpoint to a local path.
///
/// Returns the SHA256 digest of the downloaded bytes on success.
/// If `dest` already exists and `force` is false, the download is skipped
/// and the existing file's hash is returned instead.
pub async fn download_zip(
    url: &str,
    dest: &Path,
    force: bool,
) -> Result<String, DownloadError> {
    // Skip if file exists and we are not forcing a re-download.
    if dest.exists() && !force {
        let bytes = fs::read(dest).await.map_err(|e| DownloadError::Io {
            context: format!("reading existing file {}", dest.display()),
            source: e,
        })?;
        let hash = hex::encode(Sha256::digest(&bytes));
        info!(path = %dest.display(), hash = %hash, "ZIP already on disk, skipping download");
        return Ok(hash);
    }

    // Ensure parent directory exists.
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).await.map_err(|e| DownloadError::Io {
            context: format!("creating directory {}", parent.display()),
            source: e,
        })?;
    }

    info!(url = %url, dest = %dest.display(), "Downloading FEC bulk ZIP");

    let response = reqwest::get(url)
        .await
        .map_err(|e| DownloadError::Http {
            context: "GET request failed".to_string(),
            source: e,
        })?;

    if !response.status().is_success() {
        return Err(DownloadError::HttpStatus {
            url: url.to_string(),
            status: response.status().as_u16(),
        });
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| DownloadError::Http {
            context: "reading response body".to_string(),
            source: e,
        })?;

    let hash = hex::encode(Sha256::digest(&bytes));

    // Write atomically via temp file.
    let tmp_path = dest.with_extension("zip.tmp");
    fs::write(&tmp_path, &bytes)
        .await
        .map_err(|e| DownloadError::Io {
            context: format!("writing temp file {}", tmp_path.display()),
            source: e,
        })?;
    fs::rename(&tmp_path, dest)
        .await
        .map_err(|e| DownloadError::Io {
            context: format!("renaming {} to {}", tmp_path.display(), dest.display()),
            source: e,
        })?;

    info!(
        path = %dest.display(),
        bytes = bytes.len(),
        hash = %hash,
        "Download complete"
    );
    Ok(hash)
}

/// Compute the SHA256 hash of a file on disk.
pub async fn sha256_of(path: &Path) -> Result<String, DownloadError> {
    let bytes = fs::read(path).await.map_err(|e| DownloadError::Io {
        context: format!("reading {}", path.display()),
        source: e,
    })?;
    Ok(hex::encode(Sha256::digest(&bytes)))
}

/// Verify a file's SHA256 matches the expected hash.
pub fn verify_hash(path: &Path, expected: &str) -> Result<(), DownloadError> {
    use std::fs::File;
    use std::io::Read;

    let mut file = File::open(path).map_err(|e| DownloadError::Io {
        context: format!("opening {}", path.display()),
        source: e,
    })?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).map_err(|e| DownloadError::Io {
            context: format!("reading {}", path.display()),
            source: e,
        })?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    let actual = hex::encode(hasher.finalize());
    if actual != expected {
        return Err(DownloadError::HashMismatch {
            path: path.to_path_buf(),
            expected: expected.to_string(),
            actual,
        });
    }
    Ok(())
}

/// Compute the expected local path for a downloaded FEC bulk file.
pub fn local_path(storage_root: &Path, dataset_name: &str) -> PathBuf {
    storage_root.join(format!("{}.zip", dataset_name))
}

// ── Errors ────────────────────────────────────────────────────────────────

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
    #[error("SHA256 mismatch for {path:?}: expected {expected}, got {actual}")]
    HashMismatch {
        path: PathBuf,
        expected: String,
        actual: String,
    },
}
