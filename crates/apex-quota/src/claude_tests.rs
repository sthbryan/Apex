use super::*;

#[test]
fn the_usage_answer_yields_every_lane() {
    let payload: serde_json::Value = serde_json::from_str(
        r#"{"five_hour":{"utilization":65,"resets_at":"2026-08-14T05:40:00Z"},
            "seven_day":{"utilization":50,"resets_at":"2026-08-18T03:00:00Z"},
            "seven_day_opus":{"utilization":10,"resets_at":"2026-08-18T03:00:00Z"}}"#,
    )
    .expect("payload");
    let report = parse("claude", &payload).expect("report");
    assert_eq!(report.windows.len(), 3);
    assert_eq!(report.windows[0].label.as_deref(), Some("5h"));
    assert_eq!(report.windows[0].used_percent, 65);
    assert_eq!(report.windows[2].label.as_deref(), Some("1w opus"));
    assert_eq!(report.windows[1].resets_at.as_deref(), Some("2026-08-18T03:00:00Z"));
}

#[test]
fn an_answer_without_lanes_is_discarded() {
    let empty: serde_json::Value = serde_json::from_str(r#"{"other":1}"#).expect("empty");
    assert!(parse("claude", &empty).is_none());
}

fn credentials(oauth: serde_json::Value) -> Credentials {
    Credentials {
        raw: serde_json::json!({ "claudeAiOauth": oauth }),
        store: Store::File(std::path::PathBuf::from("/dev/null")),
    }
}

#[test]
fn a_token_past_its_hour_counts_as_expired() {
    let past = chrono::Utc::now().timestamp_millis() - 1;
    assert!(credentials(serde_json::json!({ "expiresAt": past })).expired());
}

#[test]
fn a_token_with_hours_left_is_kept() {
    let ahead = chrono::Utc::now().timestamp_millis() + 3_600_000;
    assert!(!credentials(serde_json::json!({ "expiresAt": ahead })).expired());
}

#[test]
fn a_grant_replaces_the_stored_pair() {
    let mut stored = credentials(serde_json::json!({
        "accessToken": "old",
        "refreshToken": "old-refresh",
        "expiresAt": 0,
    }));
    let granted = serde_json::json!({
        "access_token": "new",
        "refresh_token": "new-refresh",
        "expires_in": 28_800,
    });
    stored.adopt(&granted).expect("adopted");
    assert_eq!(stored.access().as_deref(), Some("new"));
    assert_eq!(stored.refresh_token().as_deref(), Some("new-refresh"));
    assert!(!stored.expired());
}

#[test]
fn a_grant_without_an_access_token_is_refused() {
    let mut stored = credentials(serde_json::json!({ "accessToken": "old" }));
    assert!(stored.adopt(&serde_json::json!({ "expires_in": 10 })).is_none());
    assert_eq!(stored.access().as_deref(), Some("old"));
}

#[tokio::test]
#[ignore = "needs a signed-in claude"]
async fn the_real_usage_answers() {
    let env: std::collections::BTreeMap<String, String> = std::env::vars().collect();
    let report = read("claude", &env).await.expect("report");
    println!("{report:?}");
}
