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

#[tokio::test]
#[ignore = "needs a signed-in claude"]
async fn the_real_usage_answers() {
    let env: std::collections::BTreeMap<String, String> = std::env::vars().collect();
    let report = read("claude", &env).await.expect("report");
    println!("{report:?}");
}
