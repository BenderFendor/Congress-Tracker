use capitoltrades_api::types::Trade;

#[test]
fn test_trade_deserialization() {
    let json_str = r#"{
      "_issuerId": 429442,
      "_politicianId": "C001123",
      "_txId": 20003795358,
      "chamber": "house",
      "comment": "Subholding Of...",
      "issuer": {
        "_stateId": "ca",
        "c2iq": "B9LVU1B7",
        "country": "us",
        "issuerName": "Apple Inc",
        "issuerTicker": "AAPL:US",
        "sector": "information-technology"
      },
      "owner": "not-disclosed",
      "politician": {
        "_stateId": "oh",
        "chamber": "house",
        "dob": "1969-11-16",
        "firstName": "David",
        "gender": "male",
        "lastName": "Taylor",
        "nickname": null,
        "party": "republican"
      },
      "price": 272.95,
      "pubDate": "2026-03-09T13:20:02Z",
      "reportingGap": 8,
      "txDate": "2026-02-26",
      "txType": "sell",
      "txTypeExtended": null,
      "value": 8000
    }"#;

    let trade: Result<Trade, _> = serde_json::from_str(json_str);
    match trade {
        Ok(_) => println!("Successfully deserialized Trade!"),
        Err(e) => {
            println!("Failed to deserialize: {}", e);
            std::process::exit(1);
        }
    }
}
