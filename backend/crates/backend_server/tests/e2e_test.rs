use serde_json::Value;
use std::net::TcpListener;
use std::process::Command;
use std::time::Duration;
use tokio::time::sleep;

// Helper to check if a port is available
fn get_available_port() -> Option<u16> {
    (8000..9000).find(|port| TcpListener::bind(("127.0.0.1", *port)).is_ok())
}

#[tokio::test]
async fn test_backend_e2e() {
    let port = get_available_port().expect("No free ports available in range 8000-9000");
    println!("Testing on port: {}", port);

    // Spawn the server in the background
    let mut server = Command::new("cargo")
        .args(&["run"])
        .env("PORT", port.to_string())
        .spawn()
        .expect("Failed to start server process");

    // Wait for the server to spin up and compile if needed
    // Using 30 seconds to be safe for compilation
    sleep(Duration::from_secs(30)).await;

    let client = reqwest::Client::new();

    // Make request to /api/trades
    let trades_url = format!("http://127.0.0.1:{}/api/trades", port);
    println!("Fetching {}", trades_url);
    let res = client.get(&trades_url).send().await;

    match res {
        Ok(response) => {
            let status = response.status();
            let body = response.text().await.unwrap();
            assert!(
                status.is_success(),
                "Trades request failed with status {}. Body: {}",
                status,
                body
            );

            let json: Value = serde_json::from_str(&body).expect("Failed to parse trades JSON");
            assert!(
                json.get("data").is_some(),
                "Trades response missing 'data' field"
            );
            assert!(
                json["data"].as_array().is_some(),
                "'data' field is not an array"
            );
            // Note: We don't strictly assert > 0 here in case the external site is down,
            // but we check the structure is correct.
            println!("Trades found: {}", json["data"].as_array().unwrap().len());
        }
        Err(e) => {
            let _ = server.kill();
            panic!("Trades request failed: {:?}", e);
        }
    }

    // Make request to /api/politicians
    let pol_url = format!("http://127.0.0.1:{}/api/politicians", port);
    println!("Fetching {}", pol_url);
    let res_pol = client.get(&pol_url).send().await;

    match res_pol {
        Ok(response) => {
            let status = response.status();
            let body = response.text().await.unwrap();
            assert!(
                status.is_success(),
                "Politicians request failed with status {}. Body: {}",
                status,
                body
            );

            let json: Value =
                serde_json::from_str(&body).expect("Failed to parse politicians JSON");
            assert!(
                json.get("data").is_some(),
                "Politicians response missing 'data' field"
            );
            assert!(
                json["data"].as_array().is_some(),
                "'data' field is not an array"
            );
            println!(
                "Politicians found: {}",
                json["data"].as_array().unwrap().len()
            );
        }
        Err(e) => {
            let _ = server.kill();
            panic!("Politicians request failed: {:?}", e);
        }
    }

    let _ = server.kill();
}
