//! Parsers for the FEC leadership-PAC and independent-expenditure CSV files.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LeadershipPacRow {
    #[serde(rename = "Committee_Id")]
    pub committee_id: String,
    #[serde(rename = "Committee_Name")]
    pub committee_name: String,
    #[serde(rename = "Link_Image")]
    pub filing_url: String,
    #[serde(rename = "Sponsor_Name")]
    pub sponsor_name: String,
    #[serde(rename = "Cash_on_Hand")]
    cash_on_hand: String,
    #[serde(rename = "Coverage_End_Date")]
    coverage_end_date: String,
    #[serde(rename = "Total_Disbursement")]
    total_disbursements: String,
    #[serde(rename = "Total_Receipt")]
    total_receipts: String,
}

impl LeadershipPacRow {
    pub fn cash_on_hand(&self) -> Option<f64> {
        parse_optional_amount(&self.cash_on_hand)
    }

    pub fn total_disbursements(&self) -> Option<f64> {
        parse_optional_amount(&self.total_disbursements)
    }

    pub fn total_receipts(&self) -> Option<f64> {
        parse_optional_amount(&self.total_receipts)
    }

    pub fn coverage_end_date(&self) -> Option<NaiveDate> {
        parse_csv_date(&self.coverage_end_date)
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct IndependentExpenditureRow {
    pub cand_id: String,
    pub cand_name: String,
    pub spe_id: String,
    pub spe_nam: String,
    pub ele_type: String,
    pub can_office_state: String,
    pub can_office_dis: String,
    pub can_office: String,
    pub cand_pty_aff: String,
    exp_amo: String,
    exp_date: String,
    agg_amo: String,
    pub sup_opp: String,
    pub pur: String,
    pub pay: String,
    file_num: String,
    pub amndt_ind: String,
    pub tran_id: String,
    pub image_num: String,
    receipt_dat: String,
    fec_election_yr: String,
    prev_file_num: String,
    dissem_dt: String,
}

impl IndependentExpenditureRow {
    pub fn amount(&self) -> Option<f64> {
        parse_optional_amount(&self.exp_amo)
    }

    pub fn aggregate_amount(&self) -> Option<f64> {
        parse_optional_amount(&self.agg_amo)
    }

    pub fn expenditure_date(&self) -> Option<NaiveDate> {
        parse_csv_date(&self.exp_date)
    }

    pub fn receipt_date(&self) -> Option<NaiveDate> {
        parse_csv_date(&self.receipt_dat)
    }

    pub fn dissemination_date(&self) -> Option<NaiveDate> {
        parse_csv_date(&self.dissem_dt)
    }

    pub fn election_cycle(&self) -> Option<i32> {
        self.fec_election_yr.trim().parse().ok()
    }

    pub fn file_number(&self) -> Option<i64> {
        self.file_num.trim().parse().ok()
    }

    pub fn previous_file_number(&self) -> Option<i64> {
        self.prev_file_num.trim().parse().ok()
    }

    pub fn source_key(&self) -> String {
        let transaction_id = self.tran_id.trim();
        if !transaction_id.is_empty() {
            return format!(
                "{}|{}|{}",
                self.spe_id.trim(),
                self.cand_id.trim(),
                transaction_id
            );
        }
        let fingerprint = format!(
            "{}|{}|{}|{}|{}|{}|{}",
            self.spe_id.trim(),
            self.cand_id.trim(),
            self.exp_date.trim(),
            self.dissem_dt.trim(),
            self.exp_amo.trim(),
            self.sup_opp.trim(),
            self.pay.trim()
        );
        hex::encode(Sha256::digest(fingerprint.as_bytes()))
    }
}

pub fn parse_leadership_pacs(bytes: &[u8]) -> (Vec<LeadershipPacRow>, usize) {
    let mut reader = csv::ReaderBuilder::new().flexible(true).from_reader(bytes);
    let mut rows = Vec::new();
    let mut skipped = 0;
    for result in reader.deserialize() {
        match result {
            Ok(row) => rows.push(row),
            Err(_) => skipped += 1,
        }
    }
    (rows, skipped)
}

pub fn parse_independent_expenditures(bytes: &[u8]) -> (Vec<IndependentExpenditureRow>, usize) {
    let mut reader = csv::ReaderBuilder::new().flexible(true).from_reader(bytes);
    let mut current: HashMap<String, IndependentExpenditureRow> = HashMap::new();
    let mut skipped = 0;
    for result in reader.deserialize::<IndependentExpenditureRow>() {
        let Ok(row) = result else {
            skipped += 1;
            continue;
        };
        if row.amount().is_none() || row.election_cycle().is_none() {
            skipped += 1;
            continue;
        }
        let key = row.source_key();
        match current.get(&key) {
            Some(existing) if !is_newer(&row, existing) => {}
            _ => {
                current.insert(key, row);
            }
        }
    }
    let mut rows: Vec<_> = current.into_values().collect();
    rows.sort_by_key(IndependentExpenditureRow::source_key);
    (rows, skipped)
}

pub fn normalize_person_name(value: &str) -> String {
    let source = value.trim();
    let ordered = source.split_once(',').map_or_else(
        || source.to_string(),
        |(last, rest)| format!("{} {}", rest.trim(), last.trim()),
    );
    ordered
        .split_whitespace()
        .filter(|part| {
            !matches!(
                part.trim_matches('.').to_ascii_lowercase().as_str(),
                "hon" | "jr" | "sr" | "ii" | "iii" | "iv"
            )
        })
        .flat_map(|part| part.chars())
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn is_newer(candidate: &IndependentExpenditureRow, existing: &IndependentExpenditureRow) -> bool {
    (
        candidate.file_number().unwrap_or_default(),
        candidate.receipt_date(),
    ) > (
        existing.file_number().unwrap_or_default(),
        existing.receipt_date(),
    )
}

fn parse_optional_amount(value: &str) -> Option<f64> {
    let source = value.trim();
    if source.is_empty() {
        return None;
    }
    source.parse().ok()
}

fn parse_csv_date(value: &str) -> Option<NaiveDate> {
    let source = value.trim();
    ["%d-%b-%y", "%d-%b-%Y", "%m/%d/%Y", "%Y-%m-%d"]
        .iter()
        .find_map(|format| NaiveDate::parse_from_str(source, format).ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_leadership_pac_amounts_and_sponsor() {
        let csv = b"Committee_Id,Committee_Name,Link_Image,Sponsor_Name,Cash_on_Hand,Coverage_End_Date,Total_Disbursement,Total_Receipt\n\
\"C00762328\",\"FIGHT ON PAC\",\"https://example.test/C00762328\",\"ARENHOLZ, ASHLEY HINSON\",\"102684.83\",\"31-MAY-26\",\"407403.2\",\"469193.3\"\n";
        let (rows, skipped) = parse_leadership_pacs(csv);
        assert_eq!(skipped, 0);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].committee_id, "C00762328");
        assert_eq!(rows[0].cash_on_hand(), Some(102_684.83));
        assert_eq!(
            normalize_person_name(&rows[0].sponsor_name),
            "ashleyhinsonarenholz"
        );
    }

    #[test]
    fn independent_expenditure_amendment_supersedes_original() {
        let header = "cand_id,cand_name,spe_id,spe_nam,ele_type,can_office_state,can_office_dis,can_office,cand_pty_aff,exp_amo,exp_date,agg_amo,sup_opp,pur,pay,file_num,amndt_ind,tran_id,image_num,receipt_dat,fec_election_yr,prev_file_num,dissem_dt\n";
        let original = "H6GA13070,CLARK,C00571117,PAC,P,GA,13,H,DEM,1000,15-MAY-26,1000,S,Digital,Meta,100,N,SE.5029,IMG1,16-MAY-26,2026,,15-MAY-26\n";
        let amendment = "H6GA13070,CLARK,C00571117,PAC,P,GA,13,H,DEM,1500,15-MAY-26,1500,S,Digital,Meta,101,A,SE.5029,IMG2,17-MAY-26,2026,100,15-MAY-26\n";
        let source = format!("{header}{original}{amendment}");
        let (rows, skipped) = parse_independent_expenditures(source.as_bytes());
        assert_eq!(skipped, 0);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].amount(), Some(1_500.0));
        assert_eq!(rows[0].previous_file_number(), Some(100));
    }

    #[test]
    fn malformed_ie_amount_is_not_converted_to_zero() {
        let source = b"cand_id,cand_name,spe_id,spe_nam,ele_type,can_office_state,can_office_dis,can_office,cand_pty_aff,exp_amo,exp_date,agg_amo,sup_opp,pur,pay,file_num,amndt_ind,tran_id,image_num,receipt_dat,fec_election_yr,prev_file_num,dissem_dt\n\
H6GA13070,CLARK,C00571117,PAC,P,GA,13,H,DEM,not-money,15-MAY-26,1000,S,Digital,Meta,100,N,SE.5029,IMG1,16-MAY-26,2026,,15-MAY-26\n";
        let (rows, skipped) = parse_independent_expenditures(source);
        assert!(rows.is_empty());
        assert_eq!(skipped, 1);
    }
}
