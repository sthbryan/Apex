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
fn an_omitted_percentage_inside_a_live_period_means_nothing_was_spent() {
    let payload: serde_json::Value = serde_json::from_str(
        r#"{"config":{"currentPeriod":{"type":"USAGE_PERIOD_TYPE_WEEKLY",
            "end":"2026-08-25T19:25:43Z"},"isUnifiedBillingUser":true}}"#,
    )
    .expect("payload");
    let report = parse("grok", &payload).expect("report");
    assert_eq!(report.windows[0].used_percent, 0);
    assert_eq!(report.windows[0].resets_at.as_deref(), Some("2026-08-25T19:25:43Z"));
}

#[test]
fn the_share_a_product_spent_stands_in_for_a_missing_total() {
    let payload: serde_json::Value = serde_json::from_str(
        r#"{"config":{"currentPeriod":{"end":"2026-08-25T19:25:43Z"},
            "productUsage":[{"product":"GrokBuild","usagePercent":37.4}]}}"#,
    )
    .expect("payload");
    assert_eq!(parse("grok", &payload).expect("report").windows[0].used_percent, 37);
}

#[test]
fn a_plan_with_a_limit_yields_the_share_it_spent() {
    let payload: serde_json::Value = serde_json::from_str(
        r#"{"config":{"monthlyLimit":{"val":200},"used":{"val":44},
            "billingPeriodEnd":"2026-09-01T00:00:00+00:00"}}"#,
    )
    .expect("payload");
    let report = parse("grok", &payload).expect("report");
    assert_eq!(report.windows[0].used_percent, 22);
    assert_eq!(report.windows[0].resets_at.as_deref(), Some("2026-09-01T00:00:00+00:00"));
}

#[test]
fn the_spent_amount_is_read_under_either_name() {
    let payload: serde_json::Value =
        serde_json::from_str(r#"{"config":{"monthlyLimit":{"val":50},"totalUsed":{"val":5}}}"#)
            .expect("payload");
    assert_eq!(parse("grok", &payload).expect("report").windows[0].used_percent, 10);
}

#[test]
fn a_plan_without_a_limit_reports_nothing_instead_of_zero() {
    let payload: serde_json::Value =
        serde_json::from_str(r#"{"config":{"monthlyLimit":{"val":0},"used":{"val":44}}}"#)
            .expect("payload");
    assert!(parse("grok", &payload).is_none());
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
    println!("{:?}", read("grok", &env).await);
}
