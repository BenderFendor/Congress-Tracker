use crate::models::{ProvenanceSource, ProvenanceSummary};
use crate::repository::organizations::{
    DisclosureDocumentRow, DisclosureHoldingRow, DisclosureTransactionRow, RelationshipEvidenceRow,
};
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct RelationshipQuery {
    pub subject_key: Option<String>,
    pub object_key: Option<String>,
    pub relation_type: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RelationshipEvidence {
    pub relationship_id: i64,
    pub subject_key: String,
    pub object_key: String,
    pub relation_type: String,
    pub evidence_tier: String,
    pub confidence: String,
    pub source: String,
    pub source_record_id: Option<String>,
    pub source_url: Option<String>,
    pub observed_at: Option<NaiveDate>,
    pub amount_min: Option<f64>,
    pub amount_max: Option<f64>,
    pub details: serde_json::Value,
}

impl From<RelationshipEvidenceRow> for RelationshipEvidence {
    fn from(row: RelationshipEvidenceRow) -> Self {
        Self {
            relationship_id: row.relationship_id,
            subject_key: row.subject_key,
            object_key: row.object_key,
            relation_type: row.relation_type,
            evidence_tier: row.evidence_tier,
            confidence: row.confidence,
            source: row.source,
            source_record_id: row.source_record_id,
            source_url: row.source_url,
            observed_at: row.observed_at,
            amount_min: row.amount_min,
            amount_max: row.amount_max,
            details: row.details,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct RelationshipsResponse {
    pub relationships: Vec<RelationshipEvidence>,
    pub provenance: ProvenanceSummary,
}

/// GET /api/relationships?subject_key=&object_key=&relation_type=&limit=
pub async fn list_relationships(
    State(state): State<Arc<AppState>>,
    Query(query): Query<RelationshipQuery>,
) -> Result<Json<RelationshipsResponse>, crate::models::AppError> {
    let limit = query.limit.unwrap_or(100).clamp(1, 500);
    let rows = state
        .repo
        .list_relationships(
            query.subject_key.as_deref(),
            query.object_key.as_deref(),
            query.relation_type.as_deref(),
            limit,
        )
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;
    let relationships = rows.into_iter().map(RelationshipEvidence::from).collect();
    Ok(Json(RelationshipsResponse {
        relationships,
        provenance: ProvenanceSummary {
            sources: vec![ProvenanceSource {
                source: "relationship_evidence".to_string(),
                status: "loaded".to_string(),
                fetched_at: None,
                confidence: Some("verified".to_string()),
            }],
            warnings: Vec::new(),
        },
    }))
}

#[derive(Debug, Serialize)]
pub struct OrganizationIdentifier {
    pub scheme: String,
    pub value: String,
    pub source: String,
}

#[derive(Debug, Serialize)]
pub struct OrganizationProfile {
    pub organization_id: i64,
    pub canonical_name: String,
    pub organization_type: String,
    pub description: Option<String>,
    pub website_url: Option<String>,
    pub identifiers: Vec<OrganizationIdentifier>,
    pub relationships: Vec<RelationshipEvidence>,
    pub provenance: ProvenanceSummary,
}

#[derive(Debug, Serialize)]
pub struct MemberDisclosuresResponse {
    pub bioguide_id: String,
    pub documents: Vec<DisclosureDocumentRow>,
    pub holdings: Vec<DisclosureHoldingRow>,
    pub transactions: Vec<DisclosureTransactionRow>,
    pub provenance: ProvenanceSummary,
}

/// GET /api/members/{bioguide_id}/disclosures
pub async fn get_member_disclosures(
    State(state): State<Arc<AppState>>,
    Path(bioguide_id): Path<String>,
) -> Result<Json<MemberDisclosuresResponse>, crate::models::AppError> {
    let member_exists: Option<(String,)> =
        sqlx::query_as("SELECT bioguide_id FROM members WHERE bioguide_id = $1")
            .bind(&bioguide_id)
            .fetch_optional(state.repo.pool())
            .await
            .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;
    if member_exists.is_none() {
        return Err(crate::models::AppError::NotFound(format!(
            "Member {} not found",
            bioguide_id
        )));
    }
    let documents = state
        .repo
        .list_disclosure_documents(&bioguide_id)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;
    let holdings = state
        .repo
        .list_disclosure_holdings(&bioguide_id)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;
    let transactions = state
        .repo
        .list_disclosure_transactions(&bioguide_id)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;
    let status = if documents.is_empty() {
        "empty"
    } else {
        "loaded"
    };
    Ok(Json(MemberDisclosuresResponse {
        bioguide_id,
        documents,
        holdings,
        transactions,
        provenance: ProvenanceSummary {
            sources: vec![ProvenanceSource {
                source: "house_disclosures_and_senate_efd".to_string(),
                status: status.to_string(),
                fetched_at: None,
                confidence: Some("verified".to_string()),
            }],
            warnings: if status == "empty" {
                vec!["no_disclosure_documents_loaded".to_string()]
            } else {
                Vec::new()
            },
        },
    }))
}

/// GET /api/organizations/{organization_id}
pub async fn get_organization(
    State(state): State<Arc<AppState>>,
    Path(organization_id): Path<i64>,
) -> Result<Json<OrganizationProfile>, crate::models::AppError> {
    let organization = state
        .repo
        .get_organization(organization_id)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
        .ok_or_else(|| {
            crate::models::AppError::NotFound(format!("Organization {} not found", organization_id))
        })?;
    let identifiers = state
        .repo
        .get_organization_identifiers(organization_id)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
        .into_iter()
        .map(|row| OrganizationIdentifier {
            scheme: row.scheme,
            value: row.value,
            source: row.source,
        })
        .collect();
    let key = format!("organization:{}", organization_id);
    let relationships = state
        .repo
        .list_relationships(Some(&key), None, None, 200)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
        .into_iter()
        .map(RelationshipEvidence::from)
        .collect();

    Ok(Json(OrganizationProfile {
        organization_id: organization.organization_id,
        canonical_name: organization.canonical_name,
        organization_type: organization.organization_type,
        description: organization.description,
        website_url: organization.website_url,
        identifiers,
        relationships,
        provenance: ProvenanceSummary {
            sources: vec![ProvenanceSource {
                source: "organizations".to_string(),
                status: "loaded".to_string(),
                fetched_at: None,
                confidence: Some("verified".to_string()),
            }],
            warnings: Vec::new(),
        },
    }))
}
