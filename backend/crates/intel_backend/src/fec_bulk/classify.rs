//! Conservative FEC transaction classification for public totals.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Classification {
    pub kind: &'static str,
    pub include_in_totals: bool,
}

pub fn classify_individual(
    transaction_type: Option<&str>,
    memo_code: Option<&str>,
    amount: f64,
) -> Classification {
    let code = transaction_type.unwrap_or_default().trim();
    if is_memo(code, memo_code) {
        return classification("memo", false);
    }
    if amount <= 0.0
        || matches!(
            code,
            "17R"
                | "17U"
                | "17Y"
                | "17Z"
                | "20Y"
                | "21Y"
                | "22Y"
                | "22Z"
                | "23Y"
                | "40Y"
                | "40T"
                | "41Y"
                | "41T"
                | "42Y"
                | "42T"
        )
    {
        return classification("refund_or_return", false);
    }
    if matches!(
        code,
        "10" | "11"
            | "15"
            | "15C"
            | "15E"
            | "15I"
            | "15T"
            | "30"
            | "30E"
            | "30T"
            | "31"
            | "31E"
            | "31T"
            | "32"
            | "32E"
            | "32T"
    ) {
        return classification("contribution", true);
    }
    classification("other_receipt", false)
}

pub fn classify_committee(
    transaction_type: Option<&str>,
    memo_code: Option<&str>,
    amount: f64,
) -> Classification {
    let code = transaction_type.unwrap_or_default().trim();
    if is_memo(code, memo_code) {
        return classification("memo", false);
    }
    if amount <= 0.0
        || matches!(
            code,
            "17R"
                | "17Z"
                | "20Y"
                | "21Y"
                | "22R"
                | "22Z"
                | "23Y"
                | "28L"
                | "40Y"
                | "40T"
                | "40Z"
                | "41Y"
                | "41T"
                | "41Z"
                | "42Y"
                | "42T"
                | "42Z"
        )
    {
        return classification("refund_or_return", false);
    }
    if matches!(code, "15K" | "15Z" | "18K" | "18U" | "30K" | "31K" | "32K") {
        return classification("contribution", true);
    }
    if matches!(code, "18G" | "30G" | "31G" | "32G") {
        return classification("transfer", false);
    }
    if matches!(code, "24A" | "24E") {
        return classification("independent_expenditure", false);
    }
    classification("other", false)
}

fn is_memo(transaction_type: &str, memo_code: Option<&str>) -> bool {
    memo_code.is_some_and(|code| code.eq_ignore_ascii_case("X"))
        || matches!(
            transaction_type,
            "10J" | "11J" | "15J" | "18J" | "19J" | "30F" | "30J" | "31F" | "31J" | "32F" | "32J"
        )
}

const fn classification(kind: &'static str, include_in_totals: bool) -> Classification {
    Classification {
        kind,
        include_in_totals,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn individual_contribution_is_totalable() {
        assert_eq!(
            classify_individual(Some("15"), None, 250.0),
            Classification {
                kind: "contribution",
                include_in_totals: true,
            }
        );
    }

    #[test]
    fn individual_memo_is_preserved_but_not_double_counted() {
        assert_eq!(
            classify_individual(Some("15J"), Some("X"), 250.0),
            Classification {
                kind: "memo",
                include_in_totals: false,
            }
        );
    }

    #[test]
    fn individual_refund_is_not_a_donor_contribution() {
        assert_eq!(
            classify_individual(Some("22Y"), None, 250.0),
            Classification {
                kind: "refund_or_return",
                include_in_totals: false,
            }
        );
    }

    #[test]
    fn committee_contribution_and_transfer_are_distinct() {
        assert_eq!(
            classify_committee(Some("18K"), None, 5_000.0),
            Classification {
                kind: "contribution",
                include_in_totals: true,
            }
        );
        assert_eq!(
            classify_committee(Some("18G"), None, 5_000.0),
            Classification {
                kind: "transfer",
                include_in_totals: false,
            }
        );
    }

    #[test]
    fn independent_expenditure_never_becomes_direct_receipts() {
        assert_eq!(
            classify_committee(Some("24E"), None, 50_000.0),
            Classification {
                kind: "independent_expenditure",
                include_in_totals: false,
            }
        );
    }
}
