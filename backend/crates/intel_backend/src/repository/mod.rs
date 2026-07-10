pub mod bills;
pub mod entity_resolution;
pub mod fec;
pub mod influence;
pub mod lobbying;
pub mod members;
pub mod organizations;
pub mod search;
pub mod source_runs;
pub mod trades;
pub mod votes;

use crate::cache::CacheLayer;
use crate::db::Db;
use std::sync::Arc;

/// Central data-access layer wrapping the database pool and response cache.
///
/// Every repository method is an `impl` block on this struct, keeping
/// connection and cache-lookup logic in one place.
#[derive(Clone)]
pub struct Repository {
    pub db: Db,
    pub cache: Arc<CacheLayer>,
}

impl Repository {
    /// Create a new repository with the given database and cache.
    pub fn new(db: Db, cache: Arc<CacheLayer>) -> Self {
        Self { db, cache }
    }

    /// Borrow the underlying connection pool.
    pub fn pool(&self) -> &sqlx::PgPool {
        self.db.pool()
    }
}
