use super::*;

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
async fn a_profile_without_quota_reads_nothing() {
    let bare = AgentProfile::parse("name = \"sh\"\ncommand = \"sh\"\n").expect("profile");
    let mut cache = QuotaCache::new();
    assert!(
        cache
            .read(&bare, PathBuf::from("/bin/true"), &BTreeMap::new(), false)
            .await
            .is_none()
    );
}

#[tokio::test]
async fn a_failing_command_is_cached_as_no_data() {
    let profile = AgentProfile::parse(
        "name = \"x\"\ncommand = \"x\"\n[quota]\nsource = \"command\"\nformat = \"codexbar\"\ncommand = \"false\"\ncache_ttl_secs = 60\n",
    )
    .expect("profile");

    let mut cache = QuotaCache::new();
    assert!(
        cache
            .read(&profile, PathBuf::from("/usr/bin/false"), &BTreeMap::new(), false)
            .await
            .is_none()
    );
    assert_eq!(cache.entries.len(), 1);
}

#[tokio::test]
async fn a_command_that_prints_a_report_is_parsed() {
    let profile = AgentProfile::parse(&format!(
        "name = \"claude\"\ncommand = \"x\"\n[quota]\nsource = \"command\"\nformat = \"codexbar\"\ncommand = \"echo\"\nargs = [{:?}]\ncache_ttl_secs = 60\n",
        SAMPLE.replace('\n', "")
    ))
    .expect("profile");

    let mut cache = QuotaCache::new();
    let report = cache
        .read(&profile, PathBuf::from("/bin/echo"), &BTreeMap::new(), false)
        .await
        .expect("report");
    assert_eq!(report.windows.len(), 2);
}
