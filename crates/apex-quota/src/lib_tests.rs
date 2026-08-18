use super::*;
use apex_core::QuotaFormat;

const SAMPLE: &str = r#"[{"provider":"claude",
    "pace":{"primary":{"expectedUsedPercent":43,"willLastToReset":false,"etaSeconds":1919}},
    "usage":{
    "primary":{"windowMinutes":300,"usedPercent":65,"resetsAt":"2026-08-14T05:40:00Z","resetDescription":"Resets 11:40pm"},
    "secondary":{"windowMinutes":10080,"usedPercent":50,"resetsAt":"2026-08-18T03:00:00Z"},
    "tertiary":null,
    "updatedAt":"2026-08-14T01:54:46Z"}}]"#;

#[test]
fn a_codexbar_report_yields_its_windows() {
    let report = parse(QuotaFormat::Codexbar, "claude", SAMPLE).expect("report");
    assert_eq!(report.agent, "claude");
    assert_eq!(report.windows.len(), 2);

    assert_eq!(report.windows[0].label.as_deref(), Some("5h"));
    assert_eq!(report.windows[0].used_percent, 65);
    assert_eq!(report.windows[0].reset_description.as_deref(), Some("Resets 11:40pm"));

    assert_eq!(report.windows[0].expected_percent, Some(43));
    assert_eq!(report.windows[0].lasts_to_reset, Some(false));
    assert_eq!(report.windows[0].eta_seconds, Some(1919));

    assert_eq!(report.windows[1].label.as_deref(), Some("1w"));
    assert_eq!(report.windows[1].used_percent, 50);
    assert_eq!(report.windows[1].expected_percent, None);
    assert_eq!(report.updated_at.as_deref(), Some("2026-08-14T01:54:46Z"));
}

#[test]
fn garbage_input_is_ignored_instead_of_panicking() {
    assert!(parse(QuotaFormat::Codexbar, "claude", "not json").is_none());
    assert!(parse(QuotaFormat::Codexbar, "claude", "[]").is_none());
    assert!(parse(QuotaFormat::Codexbar, "claude", "{}").is_none());
}

#[test]
fn a_report_without_usable_windows_is_discarded() {
    let empty = r#"[{"provider":"x","usage":{"primary":null,"secondary":null}}]"#;
    assert!(parse(QuotaFormat::Codexbar, "x", empty).is_none());
}

#[test]
fn percentages_are_clamped_and_rounded() {
    let odd = r#"[{"usage":{"primary":{"windowMinutes":60,"usedPercent":150.7}}}]"#;
    let report = parse(QuotaFormat::Codexbar, "x", odd).expect("report");
    assert_eq!(report.windows[0].used_percent, 100);

    let low = r#"[{"usage":{"primary":{"windowMinutes":60,"usedPercent":-5}}}]"#;
    let report = parse(QuotaFormat::Codexbar, "x", low).expect("report");
    assert_eq!(report.windows[0].used_percent, 0);
}

#[test]
fn window_labels_read_naturally() {
    assert_eq!(window_label(Some(300)).as_deref(), Some("5h"));
    assert_eq!(window_label(Some(1440)).as_deref(), Some("1d"));
    assert_eq!(window_label(Some(10080)).as_deref(), Some("1w"));
    assert_eq!(window_label(Some(45)).as_deref(), Some("45m"));
    assert_eq!(window_label(None), None);
}

#[test]
fn a_provider_without_a_declared_window_still_reports_usage() {
    let raw = r#"[{"provider":"grok","usage":{"primary":{"usedPercent":19,"resetsAt":"2026-08-18T19:25:43Z"},"secondary":null}}]"#;
    let report = parse(QuotaFormat::Codexbar, "grok", raw).expect("report");
    assert_eq!(report.windows.len(), 1);
    assert_eq!(report.windows[0].label, None);
    assert_eq!(report.windows[0].used_percent, 19);
    assert_eq!(report.windows[0].resets_at.as_deref(), Some("2026-08-18T19:25:43Z"));
}

#[tokio::test]
async fn the_first_source_that_answers_wins() {
    let sources = vec![
        Prepared::Command {
            format: QuotaFormat::Codexbar,
            binary: PathBuf::from("/usr/bin/false"),
            args: Vec::new(),
        },
        Prepared::Command {
            format: QuotaFormat::Codexbar,
            binary: PathBuf::from("/bin/echo"),
            args: vec![SAMPLE.replace('\n', "")],
        },
    ];
    let report = read_first("claude", &sources, &BTreeMap::new()).await.expect("report");
    assert_eq!(report.windows.len(), 2);
}

#[tokio::test]
async fn no_source_answering_is_no_report() {
    let sources = vec![Prepared::Command {
        format: QuotaFormat::Codexbar,
        binary: PathBuf::from("/usr/bin/false"),
        args: Vec::new(),
    }];
    assert!(read_first("x", &sources, &BTreeMap::new()).await.is_none());
    assert!(read_first("x", &[], &BTreeMap::new()).await.is_none());
}
