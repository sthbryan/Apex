use super::*;

const SAMPLE: &str = r#"{"id":2,"result":{"rateLimits":{"limitId":"codex",
    "primary":{"usedPercent":12.4,"windowDurationMins":300,"resetsAt":1789672818},
    "secondary":{"usedPercent":60,"windowDurationMins":10080,"resetsAt":1789672818},
    "credits":{"hasCredits":false},"planType":"free"}}}"#;

#[test]
fn the_app_server_answer_yields_both_windows() {
    let report = parse("codex", SAMPLE).expect("report");
    assert_eq!(report.windows.len(), 2);
    assert_eq!(report.windows[0].label.as_deref(), Some("5h"));
    assert_eq!(report.windows[0].used_percent, 12);
    assert!(report.windows[0].resets_at.as_deref().unwrap().starts_with("2026-"));
    assert_eq!(report.windows[1].label.as_deref(), Some("1w"));
    assert_eq!(report.windows[1].used_percent, 60);
}

#[test]
fn an_answer_without_windows_is_discarded() {
    let empty = r#"{"id":2,"result":{"rateLimits":{"primary":null,"secondary":null}}}"#;
    assert!(parse("codex", empty).is_none());
    assert!(parse("codex", "not json").is_none());
    assert!(parse("codex", r#"{"id":2,"error":{"code":-32601}}"#).is_none());
}

#[tokio::test]
#[ignore = "needs a signed-in codex"]
async fn the_real_app_server_answers() {
    let env: std::collections::BTreeMap<String, String> = std::env::vars().collect();
    let binary = std::path::PathBuf::from(std::env::var("CODEX_BIN").expect("CODEX_BIN"));
    let report = read("codex", &binary, &env).await.expect("report");
    println!("{report:?}");
}
