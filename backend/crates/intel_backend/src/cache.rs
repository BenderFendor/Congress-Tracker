/// In-memory response cache layer backed by Moka.
use moka::future::Cache;
use std::time::Duration;

/// A TTL-based cache for route response payloads.
///
/// Keys are typically `{route}:{normalized_query}` strings.
/// Values are serialized `serde_json::Value` payloads.
///
/// The cache is invalidated after any ingest run that writes rows.
pub struct CacheLayer {
    cache: Cache<String, serde_json::Value>,
}

impl CacheLayer {
    /// Create a new cache with the given TTL in seconds.
    pub fn new(ttl_seconds: u64) -> Self {
        let cache = Cache::builder()
            .time_to_live(Duration::from_secs(ttl_seconds))
            .build();
        Self { cache }
    }

    /// Retrieve a cached value by key.
    pub async fn get(&self, key: &str) -> Option<serde_json::Value> {
        self.cache.get(key).await
    }

    /// Insert a value into the cache.
    pub async fn set(&self, key: String, value: serde_json::Value) {
        self.cache.insert(key, value).await;
    }

    /// Invalidate all cache entries.
    pub async fn invalidate_all(&self) {
        self.cache.invalidate_all();
    }

    /// Return the number of entries currently in the cache.
    pub fn entry_count(&self) -> u64 {
        self.cache.entry_count()
    }
}
