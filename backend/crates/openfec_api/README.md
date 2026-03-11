# OpenFEC API Client

A Rust client for the Federal Election Commission's OpenFEC API, providing access to campaign finance data including candidates, committees, donations, and filings.

## Usage

### Setting up API Key

Get your API key from [api.open.fec.gov](https://api.open.fec.gov/developers/) and set it as an environment variable:

```bash
export OPENFEC_API_KEY=your_api_key_here
```

### Basic Example

```rust
use openfec_api::{Client, CandidateQuery};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create client from environment variables
    let client = Client::from_env()?;
    
    // Query candidates
    let query = CandidateQuery::default()
        .with_state("CA".to_string())
        .with_limit(10);
    
    let candidates = client.get_candidates(&query).await?;
    
    for candidate in candidates.data {
        println!("{}: {}", candidate.name, candidate.state.unwrap_or_default());
    }
    
    Ok(())
}
```

## API Endpoints

- `get_candidates()` - Fetch candidates filtered by name, state, party, office
- `get_committees()` - Fetch committees filtered by name, state, type
- `get_receipts()` - Fetch campaign contributions (Schedule A)
- `get_candidate_by_id()` - Get a specific candidate by ID
- `get_committee_by_id()` - Get a specific committee by ID

## Environment Variables

- `OPENFEC_API_KEY` - Required API key from api.open.fec.gov
- `OPENFEC_API_BASE_URL` - Optional, defaults to `https://api.open.fec.gov`

## Rate Limits

The OpenFEC API has rate limits. Sign up for a key at [api.open.fec.gov](https://api.open.fec.gov/developers/) to get higher limits (1,000 requests/hour).

## References

- [OpenFEC API Documentation](https://api.open.fec.gov/developers/)
- [FEC Website](https://www.fec.gov/)
