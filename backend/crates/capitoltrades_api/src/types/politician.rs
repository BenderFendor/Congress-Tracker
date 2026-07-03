use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

pub type PoliticianID = String;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Politician {
    #[serde(rename = "_stateId")]
    pub state_id: String,

    pub chamber: Chamber,

    pub dob: Option<String>,

    pub first_name: String,

    pub gender: Option<Gender>,

    pub last_name: String,

    pub nickname: Option<String>,

    pub party: Party,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PoliticianDetail {
    #[serde(rename = "_politicianId")]
    pub politician_id: PoliticianID,

    #[serde(rename = "_stateId")]
    pub state_id: Option<String>,

    pub party: Option<Party>,

    pub party_other: Option<serde_json::Value>,

    pub district: Option<String>,

    pub first_name: Option<String>,

    pub last_name: Option<String>,

    pub nickname: Option<String>,

    pub middle_name: Option<String>,

    pub full_name: String,

    pub dob: Option<String>,

    pub gender: Option<Gender>,

    pub social_facebook: Option<String>,

    pub social_twitter: Option<String>,

    pub social_youtube: Option<String>,

    pub website: Option<String>,

    pub chamber: Option<Chamber>,

    #[serde(default)]
    pub committees: Vec<String>,

    pub stats: Stats,
}
impl From<PoliticianDetail> for Politician {
    fn from(value: PoliticianDetail) -> Self {
        Politician {
            state_id: value.state_id.unwrap_or_default(),
            chamber: value.chamber.unwrap_or(Chamber::House),
            dob: value.dob,
            first_name: value.first_name.unwrap_or_default(),
            gender: value.gender,
            last_name: value.last_name.unwrap_or_default(),
            nickname: value.nickname,
            party: value.party.unwrap_or(Party::Other),
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub struct Stats {
    #[serde(default)]
    pub date_last_traded: Option<NaiveDate>,

    #[serde(alias = "countTrades", default)]
    pub count_trades: Option<i64>,

    #[serde(alias = "countIssuers", default)]
    pub count_issuers: Option<i64>,

    #[serde(default)]
    pub volume: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub enum Chamber {
    #[serde(rename = "house")]
    House,

    #[serde(rename = "senate")]
    Senate,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub enum Gender {
    #[serde(rename = "female")]
    Female,

    #[serde(rename = "male")]
    Male,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub enum Party {
    #[serde(rename = "democrat")]
    Democrat,

    #[serde(rename = "republican")]
    Republican,

    #[serde(rename = "other")]
    Other,
}
impl std::fmt::Display for Party {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Party::Democrat => "democrat",
                Party::Republican => "republican",
                Party::Other => "other",
            }
        )?;
        Ok(())
    }
}
