use super::*;

#[test]
fn the_billing_answer_yields_one_window() {
    let payload: serde_json::Value = serde_json::from_str(
        r#"{"config":{"creditUsagePercent":37.6,"currentPeriod":{"end":"2026-09-01T00:00:00Z"}}}"#,
    )
    .expect("payload");
    let report = parse("grok", &payload).expect("report");
    assert_eq!(report.windows.len(), 1);
    assert_eq!(report.windows[0].used_percent, 38);
    assert_eq!(report.windows[0].label, None);
    assert_eq!(report.windows[0].resets_at.as_deref(), Some("2026-09-01T00:00:00Z"));
}

#[test]
fn a_token_is_found_however_the_auth_file_nests_it() {
    let flat: serde_json::Value = serde_json::from_str(r#"{"key":"plano"}"#).expect("flat");
    assert_eq!(read_token(&flat).as_deref(), Some("plano"));

    let nested: serde_json::Value =
        serde_json::from_str(r#"{"https://auth.x.ai::abc":{"key":"anidado"}}"#).expect("nested");
    assert_eq!(read_token(&nested).as_deref(), Some("anidado"));

    let missing: serde_json::Value = serde_json::from_str(r#"{"a":{"b":1}}"#).expect("missing");
    assert_eq!(read_token(&missing), None);
}

#[tokio::test]
#[ignore = "needs a signed-in grok"]
async fn the_real_billing_answers() {
    let env: std::collections::BTreeMap<String, String> = std::env::vars().collect();
    let report = read("grok", &env).await.expect("report");
    println!("{report:?}");
}
