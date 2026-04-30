use serde::de::DeserializeOwned;
use std::process::Command;
use url::Url;

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
        Ok(())
    }

    fn get_url(&self, is_api: bool, path: &str, query: Option<&impl Query>) -> Url {
        let base = if is_api {
            self.base_api_url
        } else {
            self.web_url
        };
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
            "-H",
            &format!("User-Agent: {}", get_user_agent()),
            "-H",
            "Accept: */*",
            "-H",
            "Accept-Language: en-US,en;q=0.9",
            "-H",
            "Referer: https://www.capitoltrades.com/",
            "-H",
            "Origin: https://www.capitoltrades.com",
            "-H",
            "Connection: keep-alive",
            "-H",
            "Sec-Fetch-Dest: empty",
            "-H",
            "Sec-Fetch-Mode: cors",
            "-H",
            "Sec-Fetch-Site: same-site",
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

    fn extract_json_from_start(text: &str, start: usize) -> Option<String> {
        let mut bracket_count = 0;
        let mut in_string = false;
        let mut escape = false;

        for (i, c) in text[start..].char_indices() {
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
                        return Some(text[start..start + i + 1].to_string());
                    }
                }
                _ => {}
            }
        }
        None
    }

    fn extract_rsc_pagination(text: &str) -> crate::types::Paging {
        let total_pages = text
            .find("\"totalPages\":")
            .and_then(|i| {
                let s = &text[i + 13..];
                let end = s.find(|c: char| !c.is_ascii_digit())?;
                s[..end].parse::<i64>().ok()
            })
            .unwrap_or(1);

        let total_items = text
            .find("\"totalCount\":")
            .and_then(|i| {
                let s = &text[i + 13..];
                let end = s.find(|c: char| !c.is_ascii_digit())?;
                s[..end].parse::<i64>().ok()
            })
            .unwrap_or(1);

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

        let marker = r#""_txId":"#;
        let mut search_start = 0;
        while let Some(marker_pos) = text[search_start..].find(marker) {
            let marker_pos = search_start + marker_pos;
            search_start = marker_pos + marker.len();

            let mut inner_search_pos = marker_pos;
            while let Some(start) = text[..inner_search_pos].rfind('[') {
                if let Some(json) = Self::extract_json_from_start(&text, start) {
                    if json.contains(marker) && !json.starts_with("[\"$") {
                        if let Ok(data) = serde_json::from_str::<Vec<Trade>>(&json) {
                            let paging = Self::extract_rsc_pagination(&text);
                            return Ok(PaginatedResponse {
                                data,
                                meta: crate::types::Meta { paging },
                            });
                        }
                    }
                }
                inner_search_pos = start;
            }
        }

        let paging = Self::extract_rsc_pagination(&text);
        Ok(PaginatedResponse {
            data: Vec::new(),
            meta: crate::types::Meta { paging },
        })
    }

    pub async fn get_politicians(
        &self,
        _query: &PoliticianQuery,
    ) -> Result<PaginatedResponse<PoliticianDetail>, Error> {
        let trades_query = TradeQuery::default().with_page_size(100);
        let url = self.get_url(false, "/trades", Some(&trades_query));
        let text = self.get_curl(url, true).await?;

        let mut unique_politicians = std::collections::HashMap::new();

        // 1. Try to find the trades array first to get detailed politician info
        let marker = r#""_txId":"#;
        let mut search_start = 0;
        let mut trades = Vec::new();
        while let Some(marker_pos) = text[search_start..].find(marker) {
            let marker_pos = search_start + marker_pos;
            search_start = marker_pos + marker.len();

            let mut inner_search_pos = marker_pos;
            while let Some(start) = text[..inner_search_pos].rfind('[') {
                if let Some(json) = Self::extract_json_from_start(&text, start) {
                    if json.contains(marker) && !json.starts_with("[\"$") {
                        if let Ok(data) = serde_json::from_str::<Vec<Trade>>(&json) {
                            trades = data;
                            break;
                        }
                    }
                }
                inner_search_pos = start;
            }
            if !trades.is_empty() {
                break;
            }
        }

        for trade in trades {
            if !unique_politicians.contains_key(&trade.politician_id) {
                let p = trade.politician;
                unique_politicians.insert(
                    trade.politician_id.clone(),
                    PoliticianDetail {
                        politician_id: trade.politician_id,
                        state_id: Some(p.state_id),
                        party: Some(p.party),
                        party_other: None,
                        district: None,
                        first_name: Some(p.first_name.clone()),
                        last_name: Some(p.last_name.clone()),
                        nickname: p.nickname,
                        middle_name: None,
                        full_name: format!("{} {}", p.first_name, p.last_name),
                        dob: p.dob,
                        gender: p.gender,
                        social_facebook: None,
                        social_twitter: None,
                        social_youtube: None,
                        website: None,
                        chamber: Some(p.chamber),
                        committees: vec![],
                        stats: crate::types::Stats::default(),
                    },
                );
            }
        }

        // 2. Try to find the summary list to get more politicians
        let marker = r#""politicians":"#;
        let mut search_start = 0;
        while let Some(marker_pos) = text[search_start..].find(marker) {
            let marker_pos = search_start + marker_pos;
            search_start = marker_pos + marker.len();

            if let Some(colon_pos) = text[marker_pos..].find(':') {
                let search_after_colon = marker_pos + colon_pos;
                if let Some(array_start) = text[search_after_colon..].find('[') {
                    let absolute_start = search_after_colon + array_start;
                    if let Some(json) = Self::extract_json_from_start(&text, absolute_start) {
                        #[derive(serde::Deserialize)]
                        struct SummaryPolitician {
                            #[serde(rename = "_politicianId")]
                            politician_id: String,
                            #[serde(rename = "fullName")]
                            full_name: String,
                            stats: crate::types::Stats,
                        }

                        if let Ok(summaries) = serde_json::from_str::<Vec<SummaryPolitician>>(&json)
                        {
                            for s in summaries {
                                if let Some(existing) = unique_politicians.get_mut(&s.politician_id)
                                {
                                    existing.stats = s.stats;
                                } else {
                                    unique_politicians.insert(
                                        s.politician_id.clone(),
                                        PoliticianDetail {
                                            politician_id: s.politician_id,
                                            state_id: None,
                                            party: None,
                                            party_other: None,
                                            district: None,
                                            first_name: None,
                                            last_name: None,
                                            nickname: None,
                                            middle_name: None,
                                            full_name: s.full_name,
                                            dob: None,
                                            gender: None,
                                            social_facebook: None,
                                            social_twitter: None,
                                            social_youtube: None,
                                            website: None,
                                            chamber: None,
                                            committees: vec![],
                                            stats: s.stats,
                                        },
                                    );
                                }
                            }
                            break;
                        }
                    }
                }
            }
        }

        let data: Vec<PoliticianDetail> = unique_politicians.into_values().collect();
        let total = data.len() as i64;

        Ok(PaginatedResponse {
            data,
            meta: crate::types::Meta {
                paging: crate::types::Paging {
                    page: 1,
                    size: total,
                    total_pages: 1,
                    total_items: total,
                },
            },
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
                "-H",
                "RSC: 1",
                "-H",
                "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "https://www.capitoltrades.com/trades",
            ])
            .output()
            .expect("failed to execute curl");

        let text = String::from_utf8_lossy(&output.stdout);
        assert!(text.contains("_txId"), "Trades not found in the output!");
    }
}
