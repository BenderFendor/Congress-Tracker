use capitoltrades_api::client::CapitolTradesClient;
use capitoltrades_api::query::IssuerQuery;

#[tokio::main]
async fn main() {
    let client = CapitolTradesClient::new();
    let query = IssuerQuery::default().with_search("AAPL");
    match client.get_issuers(&query).await {
        Ok(res) => println!("SUCCESS: {:?}", res.data.len()),
        Err(e) => println!("ERROR: {:?}", e),
    }
}
