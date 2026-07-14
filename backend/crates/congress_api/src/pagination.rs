use std::collections::HashSet;

use thiserror::Error;
use url::Url;

use crate::types::{MemberSponsoredBill, Pagination};

pub const MEMBER_LEGISLATION_PAGE_LIMIT: u32 = 250;
pub const MEMBER_LEGISLATION_MIN_PAGE_LIMIT: u32 = 50;
pub const MEMBER_LEGISLATION_MAX_ROWS: u32 = 50_000;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MemberLegislationIdentity {
    pub congress: i32,
    pub bill_type: String,
    pub number: String,
}

impl MemberLegislationIdentity {
    fn from_valid_bill(bill: &MemberSponsoredBill) -> Option<Self> {
        if bill.congress <= 0 {
            return None;
        }
        let bill_identity = || {
            let number = bill
                .number
                .as_deref()?
                .trim()
                .parse::<u32>()
                .ok()
                .filter(|number| *number > 0)?
                .to_string();
            let bill_type = bill.bill_type.as_deref()?.trim().to_ascii_lowercase();
            (!bill_type.is_empty()).then_some(Self {
                congress: bill.congress,
                bill_type,
                number,
            })
        };
        bill_identity().or_else(|| {
            let source_url = canonical_member_legislation_source_url(bill.url.as_deref()?)?;
            Some(Self {
                congress: bill.congress,
                bill_type: "source-url".to_string(),
                number: source_url,
            })
        })
    }
}

pub fn canonical_member_legislation_source_url(url: &str) -> Option<String> {
    let source_url = url.split('?').next()?.trim();
    (!source_url.is_empty()).then(|| source_url.to_ascii_lowercase())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PageProgress {
    Complete,
    Next { offset: u32 },
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PaginationError {
    #[error("page limit must be between 1 and {MEMBER_LEGISLATION_PAGE_LIMIT}, got {0}")]
    InvalidLimit(u32),
    #[error("provider advertised {0} rows, exceeding the {MEMBER_LEGISLATION_MAX_ROWS}-row bound")]
    AdvertisedCountTooLarge(u32),
    #[error("provider count changed from {expected} to {actual} during pagination")]
    CountChanged { expected: u32, actual: u32 },
    #[error("expected offset {expected}, got {actual}")]
    UnexpectedOffset { expected: u32, actual: u32 },
    #[error("page contained {actual} rows, exceeding its {limit}-row limit")]
    OversizedPage { limit: u32, actual: usize },
    #[error("provider returned an empty page after {seen} of {expected} advertised rows")]
    PrematureEmpty { seen: u32, expected: u32 },
    #[error("provider returned {seen} rows, exceeding its advertised count of {expected}")]
    SeenExceedsCount { seen: u32, expected: u32 },
    #[error("provider supplied a next page after all {0} advertised rows were received")]
    NextAfterComplete(u32),
    #[error("provider omitted the next page after {seen} of {expected} advertised rows")]
    MissingNext { seen: u32, expected: u32 },
    #[error("provider next URL is invalid: {0}")]
    InvalidNextUrl(String),
    #[error("provider next URL has no numeric offset")]
    MissingNextOffset,
    #[error("provider next offset did not advance: current {current}, next {next}")]
    NonAdvancingNext { current: u32, next: u32 },
    #[error("provider next offset {actual} does not match expected offset {expected}")]
    UnexpectedNextOffset { expected: u32, actual: u32 },
    #[error("pagination offset overflowed")]
    OffsetOverflow,
}

#[derive(Debug, Default)]
pub struct MemberLegislationPagination {
    advertised_count: Option<u32>,
    next_offset: u32,
    rows_seen: u32,
    duplicate_rows: u32,
    identities: HashSet<MemberLegislationIdentity>,
}

impl MemberLegislationPagination {
    pub fn rows_seen(&self) -> u32 {
        self.rows_seen
    }

    pub fn advertised_count(&self) -> Option<u32> {
        self.advertised_count
    }

    pub fn duplicate_rows(&self) -> u32 {
        self.duplicate_rows
    }

    pub fn accept_page(
        &mut self,
        offset: u32,
        limit: u32,
        pagination: &Pagination,
        bills: &[MemberSponsoredBill],
    ) -> Result<PageProgress, PaginationError> {
        if limit == 0 || limit > MEMBER_LEGISLATION_PAGE_LIMIT {
            return Err(PaginationError::InvalidLimit(limit));
        }
        if pagination.count > MEMBER_LEGISLATION_MAX_ROWS {
            return Err(PaginationError::AdvertisedCountTooLarge(pagination.count));
        }
        if offset != self.next_offset {
            return Err(PaginationError::UnexpectedOffset {
                expected: self.next_offset,
                actual: offset,
            });
        }
        if bills.len() > limit as usize {
            return Err(PaginationError::OversizedPage {
                limit,
                actual: bills.len(),
            });
        }
        if let Some(expected) = self.advertised_count {
            if expected != pagination.count {
                return Err(PaginationError::CountChanged {
                    expected,
                    actual: pagination.count,
                });
            }
        } else {
            self.advertised_count = Some(pagination.count);
        }

        let prospective_seen = self
            .rows_seen()
            .checked_add(bills.len() as u32)
            .ok_or(PaginationError::OffsetOverflow)?;
        if bills.is_empty() && prospective_seen < pagination.count {
            return Err(PaginationError::PrematureEmpty {
                seen: prospective_seen,
                expected: pagination.count,
            });
        }
        if prospective_seen > pagination.count {
            return Err(PaginationError::SeenExceedsCount {
                seen: prospective_seen,
                expected: pagination.count,
            });
        }

        let page_identities: Vec<_> = bills
            .iter()
            .filter_map(MemberLegislationIdentity::from_valid_bill)
            .collect();
        let mut page_unique = HashSet::new();
        for identity in &page_identities {
            if self.identities.contains(identity) || !page_unique.insert(identity) {
                self.duplicate_rows = self
                    .duplicate_rows
                    .checked_add(1)
                    .ok_or(PaginationError::OffsetOverflow)?;
            }
        }

        if prospective_seen == pagination.count {
            if pagination.next_url.is_some() {
                return Err(PaginationError::NextAfterComplete(pagination.count));
            }
            self.identities.extend(page_identities);
            self.rows_seen = prospective_seen;
            self.next_offset = prospective_seen;
            return Ok(PageProgress::Complete);
        }

        let next_url = pagination
            .next_url
            .as_ref()
            .ok_or(PaginationError::MissingNext {
                seen: prospective_seen,
                expected: pagination.count,
            })?;
        let parsed = Url::parse(next_url)
            .map_err(|error| PaginationError::InvalidNextUrl(error.to_string()))?;
        let next = parsed
            .query_pairs()
            .find_map(|(key, value)| (key == "offset").then(|| value.parse::<u32>()))
            .ok_or(PaginationError::MissingNextOffset)?
            .map_err(|_| PaginationError::MissingNextOffset)?;
        if next <= offset {
            return Err(PaginationError::NonAdvancingNext {
                current: offset,
                next,
            });
        }
        if next != prospective_seen {
            return Err(PaginationError::UnexpectedNextOffset {
                expected: prospective_seen,
                actual: next,
            });
        }

        self.identities.extend(page_identities);
        self.rows_seen = prospective_seen;
        self.next_offset = next;
        Ok(PageProgress::Next { offset: next })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bill(number: u32) -> MemberSponsoredBill {
        MemberSponsoredBill {
            congress: 119,
            url: Some(format!("https://api.congress.gov/v3/bill/119/hr/{number}")),
            bill_type: Some("HR".to_string()),
            number: Some(number.to_string()),
            title: Some(format!("Bill {number}")),
            introduced_date: None,
            latest_action: None,
            policy_area: None,
        }
    }

    fn page(count: u32, next_offset: Option<u32>) -> Pagination {
        Pagination {
            count,
            next_url: next_offset.map(|offset| {
                format!("https://api.congress.gov/v3/member/X/sponsored-legislation?limit=250&offset={offset}")
            }),
            previous_url: None,
        }
    }

    #[test]
    fn exhausts_three_pages_with_run_wide_identity_tracking() {
        let mut state = MemberLegislationPagination::default();
        let first: Vec<_> = (1..=250).map(bill).collect();
        let second: Vec<_> = (251..=500).map(bill).collect();
        let third: Vec<_> = (501..=520).map(bill).collect();

        assert_eq!(
            state.accept_page(0, 250, &page(520, Some(250)), &first),
            Ok(PageProgress::Next { offset: 250 })
        );
        assert_eq!(
            state.accept_page(250, 250, &page(520, Some(500)), &second),
            Ok(PageProgress::Next { offset: 500 })
        );
        assert_eq!(
            state.accept_page(500, 250, &page(520, None), &third),
            Ok(PageProgress::Complete)
        );
        assert_eq!(state.rows_seen(), 520);
        assert_eq!(state.advertised_count(), Some(520));
    }

    #[test]
    fn accepts_a_smaller_page_limit_without_weakening_offset_checks() {
        let mut state = MemberLegislationPagination::default();
        let first: Vec<_> = (1..=250).map(bill).collect();
        let second: Vec<_> = (251..=350).map(bill).collect();

        assert_eq!(
            state.accept_page(0, 250, &page(350, Some(250)), &first),
            Ok(PageProgress::Next { offset: 250 })
        );
        assert_eq!(
            state.accept_page(250, 100, &page(350, None), &second),
            Ok(PageProgress::Complete)
        );
        assert_eq!(state.rows_seen(), 350);
    }

    #[test]
    fn accepts_official_member_totals_above_ten_thousand_within_the_safety_bound() {
        let mut state = MemberLegislationPagination::default();

        assert_eq!(
            state.accept_page(0, 250, &page(10_492, Some(1)), &[bill(1)]),
            Ok(PageProgress::Next { offset: 1 })
        );
        assert_eq!(state.advertised_count(), Some(10_492));
        assert_eq!(state.rows_seen(), 1);
    }

    #[test]
    fn accepts_a_verified_empty_result() {
        let mut state = MemberLegislationPagination::default();
        assert_eq!(
            state.accept_page(0, 250, &page(0, None), &[]),
            Ok(PageProgress::Complete)
        );
    }

    #[test]
    fn nullable_provider_strings_remain_counted_for_row_level_validation() {
        let response: crate::types::MemberSponsoredResponse =
            serde_json::from_value(serde_json::json!({
                "sponsoredLegislation": [{
                    "congress": 119,
                    "url": "https://api.congress.gov/v3/amendment/119/hamdt/1",
                    "type": null,
                    "number": null,
                    "title": null,
                    "introducedDate": null,
                    "latestAction": null,
                    "policyArea": {"name": null}
                }],
                "pagination": {"count": 1, "next": null, "previous": null},
                "request": null
            }))
            .expect("nullable row fields must not discard the whole provider page");
        let mut state = MemberLegislationPagination::default();

        assert_eq!(
            state.accept_page(
                0,
                250,
                &response.pagination,
                &response.sponsored_legislation
            ),
            Ok(PageProgress::Complete)
        );
        assert_eq!(state.rows_seen(), 1);
    }

    #[test]
    fn rejects_changed_count_without_mutating_accepted_rows() {
        let mut state = MemberLegislationPagination::default();
        assert!(state
            .accept_page(
                0,
                250,
                &page(300, Some(250)),
                &(1..=250).map(bill).collect::<Vec<_>>()
            )
            .is_ok());
        assert_eq!(
            state.accept_page(
                250,
                250,
                &page(301, None),
                &(251..=300).map(bill).collect::<Vec<_>>()
            ),
            Err(PaginationError::CountChanged {
                expected: 300,
                actual: 301
            })
        );
        assert_eq!(state.rows_seen(), 250);
    }

    #[test]
    fn counts_duplicate_identity_across_pages_without_multiplying_evidence() {
        let mut state = MemberLegislationPagination::default();
        assert!(state
            .accept_page(0, 2, &page(3, Some(2)), &[bill(1), bill(2)])
            .is_ok());
        assert_eq!(
            state.accept_page(2, 2, &page(3, None), &[bill(2)]),
            Ok(PageProgress::Complete)
        );
        assert_eq!(state.rows_seen(), 3);
        assert_eq!(state.duplicate_rows(), 1);
    }

    #[test]
    fn counts_duplicate_identity_within_a_page() {
        let mut state = MemberLegislationPagination::default();
        assert_eq!(
            state.accept_page(0, 2, &page(2, None), &[bill(1), bill(1)]),
            Ok(PageProgress::Complete)
        );
        assert_eq!(state.rows_seen(), 2);
        assert_eq!(state.duplicate_rows(), 1);
    }

    #[test]
    fn counts_semantic_duplicate_case_whitespace_and_number_padding() {
        let mut padded = bill(1);
        padded.bill_type = Some(" hr ".to_string());
        padded.number = Some("001".to_string());
        let mut state = MemberLegislationPagination::default();

        assert_eq!(
            state.accept_page(0, 2, &page(2, None), &[bill(1), padded]),
            Ok(PageProgress::Complete)
        );
        assert_eq!(state.duplicate_rows(), 1);
    }

    #[test]
    fn url_fallback_identity_matches_persistence_normalization() {
        assert_eq!(
            canonical_member_legislation_source_url(
                " HTTPS://API.CONGRESS.GOV/v3/Amendment/119/HAMDT/1?format=json "
            ),
            Some("https://api.congress.gov/v3/amendment/119/hamdt/1".to_string())
        );
    }

    #[test]
    fn rejects_premature_empty_and_missing_next() {
        let mut empty_state = MemberLegislationPagination::default();
        assert_eq!(
            empty_state.accept_page(0, 250, &page(1, None), &[]),
            Err(PaginationError::PrematureEmpty {
                seen: 0,
                expected: 1
            })
        );
        let mut missing_next_state = MemberLegislationPagination::default();
        assert_eq!(
            missing_next_state.accept_page(0, 250, &page(2, None), &[bill(1)]),
            Err(PaginationError::MissingNext {
                seen: 1,
                expected: 2
            })
        );
    }

    #[test]
    fn rejects_nonadvancing_and_inexact_next_offsets() {
        let mut state = MemberLegislationPagination::default();
        assert_eq!(
            state.accept_page(0, 2, &page(3, Some(0)), &[bill(1), bill(2)]),
            Err(PaginationError::NonAdvancingNext {
                current: 0,
                next: 0
            })
        );
        assert_eq!(
            state.accept_page(0, 2, &page(3, Some(1)), &[bill(1), bill(2)]),
            Err(PaginationError::UnexpectedNextOffset {
                expected: 2,
                actual: 1
            })
        );
    }

    #[test]
    fn rejects_oversize_pages_counts_and_limits() {
        let mut state = MemberLegislationPagination::default();
        assert_eq!(
            state.accept_page(0, 1, &page(2, None), &[bill(1), bill(2)]),
            Err(PaginationError::OversizedPage {
                limit: 1,
                actual: 2
            })
        );
        assert_eq!(
            state.accept_page(0, 250, &page(MEMBER_LEGISLATION_MAX_ROWS + 1, None), &[]),
            Err(PaginationError::AdvertisedCountTooLarge(
                MEMBER_LEGISLATION_MAX_ROWS + 1
            ))
        );
        assert_eq!(
            state.accept_page(0, 0, &page(0, None), &[]),
            Err(PaginationError::InvalidLimit(0))
        );
        assert_eq!(
            state.accept_page(0, 251, &page(0, None), &[]),
            Err(PaginationError::InvalidLimit(251))
        );
    }

    #[test]
    fn rejects_rows_beyond_count_and_next_after_completion() {
        let mut state = MemberLegislationPagination::default();
        assert_eq!(
            state.accept_page(0, 2, &page(1, None), &[bill(1), bill(2)]),
            Err(PaginationError::SeenExceedsCount {
                seen: 2,
                expected: 1
            })
        );
        assert_eq!(
            state.accept_page(0, 1, &page(1, Some(1)), &[bill(1)]),
            Err(PaginationError::NextAfterComplete(1))
        );
    }
}
