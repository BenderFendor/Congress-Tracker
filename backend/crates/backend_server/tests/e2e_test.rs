use reqwest::StatusCode;
use serde_json::Value;
use std::net::TcpListener;
use std::process::{Child, Command};
use std::time::Duration;
use tokio::time::{sleep, timeout};

fn get_available_port() -> u16 {
    (8000..9000)
        .find(|port| TcpListener::bind(("127.0.0.1", *port)).is_ok())
        .expect("No free ports available in range 8000-9000")
}

async fn wait_for_health(base_url: &str) -> reqwest::Client {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .expect("Failed to build HTTP client");
    timeout(Duration::from_secs(30), async {
        loop {
            if let Ok(response) = client.get(format!("{base_url}/api/health")).send().await {
                if response.status() == StatusCode::OK {
                    return client;
                }
            }
            sleep(Duration::from_millis(250)).await;
        }
    })
    .await
    .expect("Canonical intel backend did not become healthy")
}

fn spawn_intel_backend(port: u16) -> Option<Child> {
    let database_url = match std::env::var("DATABASE_URL") {
        Ok(value) if !value.is_empty() => value,
        _ => return None,
    };
    Some(
        Command::new("cargo")
            .args(["run", "-p", "intel_backend", "--bin", "intel_backend"])
            .env("DATABASE_URL", database_url)
            .env("PORT", port.to_string())
            .spawn()
            .expect("Failed to start canonical intel backend"),
    )
}

#[tokio::test]
async fn test_canonical_backend_e2e() {
    let port = get_available_port();
    let Some(mut server) = spawn_intel_backend(port) else {
        eprintln!("Skipping canonical e2e: DATABASE_URL is not set");
        return;
    };
    let base_url = format!("http://127.0.0.1:{port}");
    let client = wait_for_health(&base_url).await;

    let health: Value = client
        .get(format!("{base_url}/api/health"))
        .send()
        .await
        .expect("Health request failed")
        .json()
        .await
        .expect("Health response was not JSON");
    assert_eq!(health["status"], "ok");
    assert_eq!(health["db"], true);

    let coverage: Value = client
        .get(format!("{base_url}/api/sources/coverage"))
        .send()
        .await
        .expect("Source coverage request failed")
        .json()
        .await
        .expect("Source coverage response was not JSON");
    assert!(coverage["sources"].is_array());
    assert!(coverage["summary"]["total"].as_u64().unwrap_or(0) > 0);

    let members: Value = client
        .get(format!("{base_url}/api/legislators?limit=1"))
        .send()
        .await
        .expect("Legislator request failed")
        .json()
        .await
        .expect("Legislator response was not JSON");
    assert!(members.is_array());

    let _ = server.kill();
    let _ = server.wait();
}
