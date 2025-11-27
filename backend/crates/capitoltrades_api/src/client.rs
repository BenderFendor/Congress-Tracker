use serde::de::DeserializeOwned;
use url::Url;

use crate::{
    query::{IssuerQuery, PoliticianQuery, Query, TradeQuery},
    types::{IssuerDetail, PaginatedResponse, PoliticianDetail, Response, Trade},
    user_agent::get_user_agent,
    Error,
};

    pub struct Client {
        base_api_url: &'static str,
        http_client: reqwest::Client,
    }

    impl Client {
        pub fn new() -> Self {
            let http_client = reqwest::Client::builder()
                .user_agent(get_user_agent())
                .cookie_store(true)
                .build()
                .expect("Failed to build HTTP client");

            Self {
                base_api_url: "https://bff.capitoltrades.com",
                http_client,
            }
        }

        pub async fn prime_cookies(&self) -> Result<(), Error> {
            self.http_client
                .get("https://www.capitoltrades.com")
                .send()
                .await
                .map_err(|e| {
                    tracing::error!("Failed to prime cookies: {}", e);
                    Error::RequestFailed
                })?;
            Ok(())
        }

        fn get_url(&self, path: &str, query: Option<&impl Query>) -> Url {
            let mut url = Url::parse(format!("{}{}", &self.base_api_url, path).as_str()).unwrap();
            match query {
                Some(query) => query.add_to_url(&mut url),
                None => url,
            }
        }

        async fn get<T, Q>(&self, path: &str, query: Option<&Q>) -> Result<T, Error>
        where
            T: DeserializeOwned,
            Q: Query,
        {
            // Ensure we have cookies by hitting the main site first if needed
            // For now, we'll just rely on the cookie store being persistent for the client instance
            // and maybe hit the main site once on startup (which we can't easily do in new(), so we might need an init method or just do it here lazily)
            
            // Actually, let's just try to hit the API directly first with the cookie store enabled. 
            // If that fails, we might need to hit the main site.
            // But to be safe, let's hit the main site once if we haven't. 
            // Since we don't have mutable state easily here without interior mutability, let's just try to hit the main site in a separate method or just trust the cookie store.
            // Wait, to hit the main site we need to use the SAME client instance.
            
            let url = self.get_url(path, query);
            let resp = self.http_client
                .get(url)
                .header("content-type", "application/json")
                .header("origin", "https://www.capitoltrades.com")
                .header("referer", "https://www.capitoltrades.com")
                .header("accept", "*/*")
                .header("accept-language", "en-US,en;q=0.9")
                .header("sec-fetch-dest", "empty")
                .header("sec-fetch-mode", "cors")
                .header("sec-fetch-site", "same-site")
                .send()
                .await
                .map_err(|e| {
                    tracing::error!("Failed to get resource: {}", e);
                    Error::RequestFailed
                })?;

            let text = resp.text().await.map_err(|e| {
                tracing::error!("Failed to get response text: {}", e);
                Error::RequestFailed
            })?;

            let val: T = serde_json::from_str(&text).map_err(|e| {
                tracing::error!("Failed to parse resource: {}. Body: {}", e, text);
                Error::RequestFailed
            })?;
            Ok(val)
        }

    pub async fn get_trades(&self, query: &TradeQuery) -> Result<PaginatedResponse<Trade>, Error> {
        self.get::<PaginatedResponse<Trade>, TradeQuery>("/trades", Some(query))
            .await
    }

    pub async fn get_politicians(
        &self,
        query: &PoliticianQuery,
    ) -> Result<PaginatedResponse<PoliticianDetail>, Error> {
        self.get::<PaginatedResponse<PoliticianDetail>, PoliticianQuery>(
            "/politicians",
            Some(query),
        )
        .await
    }

    pub async fn get_issuer(&self, issuer_id: i64) -> Result<Response<IssuerDetail>, Error> {
        self.get::<Response<IssuerDetail>, IssuerQuery>(
            format!("/issuers/{}", issuer_id).as_str(),
            None,
        )
        .await
    }

    pub async fn get_issuers(
        &self,
        query: &IssuerQuery,
    ) -> Result<PaginatedResponse<IssuerDetail>, Error> {
        self.get::<PaginatedResponse<IssuerDetail>, IssuerQuery>("/issuers", Some(query))
            .await
    }
}
