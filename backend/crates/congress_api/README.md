# Congress.gov API Client

A Rust client for the Congress.gov API, providing access to legislative data including bills, amendments, votes, and member information.

## Usage

### Setting up API Key

Get your API key from [api.data.gov](https://api.data.gov/) and set it as an environment variable:

```bash
export CONGRESS_GOV_API_KEY=your_api_key_here
```

### Basic Example

```rust
use congress_api::{Client, BillQuery};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create client from environment variables
    let client = Client::from_env()?;
    
    // Query bills
    let query = BillQuery::default()
        .with_congress(118)
        .with_limit(10);
    
    let bills = client.get_bills(&query).await?;
    
    for bill in bills.data {
        println!("{}: {}", bill.number, bill.title);
    }
    
    Ok(())
}
```

## API Endpoints

- `get_bills()` - Fetch bills filtered by congress, chamber, type, etc.
- `get_members()` - Fetch members filtered by state, district, chamber, party
- `get_votes()` - Fetch roll call votes
- `get_member_by_id()` - Get a specific member by bioguide ID

## Environment Variables

- `CONGRESS_GOV_API_KEY` - Required API key from api.data.gov
- `CONGRESS_GOV_API_BASE_URL` - Optional, defaults to `https://api.congress.gov`

## Rate Limits

The Congress.gov API has rate limits. Sign up for a key at [api.data.gov](https://api.data.gov/) to get higher limits.

## References

- [Congress.gov API Documentation](https://api.congress.gov/)
- [api.data.gov Signup](https://api.data.gov/signup/)
