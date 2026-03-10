use serde::de::DeserializeOwned;
use url::Url;
use std::process::Command;

use crate::{
    query::{IssuerQuery, PoliticianQuery, Query, TradeQuery},
    types::{IssuerDetail, PaginatedResponse, PoliticianDetail, Response, Trade},
    user_agent::get_user_agent,
    Error,
};

pub struct Client {
    base_api_url: &'static str,
    web_url: &'static str,
}

impl Client {
    pub fn new() -> Self {
        Self {
            base_api_url: "https://bff.capitoltrades.com",
            web_url: "https://www.capitoltrades.com",
        }
    }

    pub async fn prime_cookies(&self) -> Result<(), Error> {
        // Not strictly needed with curl if we just pass User-Agent
        Ok(())
    }

    fn get_url(&self, is_api: bool, path: &str, query: Option<&impl Query>) -> Url {
        let base = if is_api { self.base_api_url } else { self.web_url };
        let mut url = Url::parse(format!("{}{}", base, path).as_str()).unwrap();
        match query {
            Some(query) => query.add_to_url(&mut url),
            None => url,
        }
    }

    async fn get_curl(&self, url: Url, is_rsc: bool) -> Result<String, Error> {
        let mut cmd = Command::new("curl");
        cmd.args(&[
            "-s",
            "-H", &format!("User-Agent: {}", get_user_agent()),
            "-H", "Accept: */*",
            "-H", "Accept-Language: en-US,en;q=0.9",
            "-H", "Referer: https://www.capitoltrades.com/",
            "-H", "Origin: https://www.capitoltrades.com",
            "-H", "Connection: keep-alive",
            "-H", "Sec-Fetch-Dest: empty",
            "-H", "Sec-Fetch-Mode: cors",
            "-H", "Sec-Fetch-Site: same-site",
        ]);

        if is_rsc {
            cmd.arg("-H").arg("RSC: 1");
        }

        cmd.arg(url.as_str());

        let output = cmd.output().map_err(|e| {
            tracing::error!("Curl failed to execute: {}", e);
            Error::RequestFailed
        })?;

        if !output.status.success() {
            tracing::error!("Curl returned error status");
            return Err(Error::RequestFailed);
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    async fn get_api<T, Q>(&self, path: &str, query: Option<&Q>) -> Result<T, Error>
    where
        T: DeserializeOwned,
        Q: Query,
    {
        let url = self.get_url(true, path, query);
        let text = self.get_curl(url, false).await?;

        let val: T = serde_json::from_str(&text).map_err(|e| {
            tracing::error!("Failed to parse resource: {}. Body: {}", e, text);
            Error::RequestFailed
        })?;
        Ok(val)
    }

    fn extract_rsc_json_array(text: &str, marker: &str) -> Option<String> {
        let start = text.find(marker)?;
        let array_start = text[..start].rfind('[')?;
        
        let mut bracket_count = 0;
        let mut in_string = false;
        let mut escape = false;
        
        for (i, c) in text[array_start..].char_indices() {
            if escape {
                escape = false;
                continue;
            }
            match c {
                '\\' => escape = true,
                '"' => in_string = !in_string,
                '[' if !in_string => bracket_count += 1,
                ']' if !in_string => {
                    bracket_count -= 1;
                    if bracket_count == 0 {
                        return Some(text[array_start..array_start + i + 1].to_string());
                    }
                }
                _ => {}
            }
        }
        None
    }

    fn extract_rsc_pagination(text: &str) -> crate::types::Paging {
        let total_pages = text.find("\"totalPages\":").and_then(|i| {
            let s = &text[i + 13..];
            let end = s.find(|c: char| !c.is_ascii_digit())?;
            s[..end].parse::<i64>().ok()
        }).unwrap_or(1);

        let total_items = text.find("\"totalCount\":").and_then(|i| {
            let s = &text[i + 13..];
            let end = s.find(|c: char| !c.is_ascii_digit())?;
            s[..end].parse::<i64>().ok()
        }).unwrap_or(1);

        crate::types::Paging {
            page: 1,
            size: 15,
            total_pages,
            total_items,
        }
    }

    pub async fn get_trades(&self, query: &TradeQuery) -> Result<PaginatedResponse<Trade>, Error> {
        let url = self.get_url(false, "/trades", Some(query));
        let text = self.get_curl(url, true).await?;
        
        let json_array = Self::extract_rsc_json_array(&text, r#"{"_txId":"#).or_else(|| Self::extract_rsc_json_array(&text, r#"{"_issuerId":"#));
        
        let data: Vec<Trade> = if let Some(json) = json_array {
            serde_json::from_str(&json).map_err(|e| {
                tracing::error!("Failed to parse trades array: {}", e);
                Error::RequestFailed
            })?
        } else {
            Vec::new()
        };

        let paging = Self::extract_rsc_pagination(&text);

        Ok(PaginatedResponse {
            data,
            meta: crate::types::Meta { paging },
        })
    }

    pub async fn get_politicians(
        &self,
        query: &PoliticianQuery,
    ) -> Result<PaginatedResponse<PoliticianDetail>, Error> {
        let url = self.get_url(false, "/politicians", Some(query));
        let text = self.get_curl(url, true).await?;
        
        let json_array = Self::extract_rsc_json_array(&text, r#"{"_politicianId":"#);
        
        let data: Vec<PoliticianDetail> = if let Some(json) = json_array {
            serde_json::from_str(&json).map_err(|e| {
                tracing::error!("Failed to parse politicians array: {}", e);
                Error::RequestFailed
            })?
        } else {
            Vec::new()
        };

        let paging = Self::extract_rsc_pagination(&text);

        Ok(PaginatedResponse {
            data,
            meta: crate::types::Meta { paging },
        })
    }

    pub async fn get_issuer(&self, issuer_id: i64) -> Result<Response<IssuerDetail>, Error> {
        self.get_api::<Response<IssuerDetail>, IssuerQuery>(
            format!("/issuers/{}", issuer_id).as_str(),
            None,
        )
        .await
    }

    pub async fn get_issuers(
        &self,
        query: &IssuerQuery,
    ) -> Result<PaginatedResponse<IssuerDetail>, Error> {
        self.get_api::<PaginatedResponse<IssuerDetail>, IssuerQuery>("/issuers", Some(query))
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    #[test]
    fn test_curl_extract_trades() {
        let output = Command::new("curl")
            .args(&[
                "-s",
                "-H", "RSC: 1",
                "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "https://www.capitoltrades.com/trades"
            ])
            .output()
            .expect("failed to execute curl");
            
        let text = String::from_utf8_lossy(&output.stdout);
        assert!(text.contains("_txId"), "Trades not found in the output!");
        
        let start = text.find(r#"{"_issuerId":"#).unwrap_or(0);
        let array_start = text[..start].rfind('[').unwrap_or(0);
        println!("Array start: {}", &text[array_start..array_start+100]);
    }
}
