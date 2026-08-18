use super::*;

#[test]
fn window_labels_read_naturally() {
    assert_eq!(window_label(Some(300)).as_deref(), Some("5h"));
    assert_eq!(window_label(Some(1440)).as_deref(), Some("1d"));
    assert_eq!(window_label(Some(10080)).as_deref(), Some("1w"));
    assert_eq!(window_label(Some(45)).as_deref(), Some("45m"));
    assert_eq!(window_label(None), None);
}

#[test]
fn percentages_are_clamped_and_rounded() {
    assert_eq!(percent(150.7), 100);
    assert_eq!(percent(-5.0), 0);
    assert_eq!(percent(37.6), 38);
}

#[test]
fn an_epoch_becomes_a_stamp_the_front_can_read() {
    assert!(iso_from_epoch(1789672818).expect("stamp").starts_with("2026-"));
}

#[test]
fn a_native_source_is_only_offered_for_agents_that_have_one() {
    let binary = PathBuf::from("/bin/echo");
    assert_eq!(
        Prepared::native("codex", binary.clone()),
        Some(Prepared::CodexAppServer { binary: binary.clone() })
    );
    assert_eq!(Prepared::native("grok", binary.clone()), Some(Prepared::GrokBilling));
    assert_eq!(Prepared::native("claude", binary.clone()), Some(Prepared::ClaudeOauth));
    assert_eq!(
        Prepared::native("antigravity", binary.clone()),
        Some(Prepared::AntigravityLanguageServer { binary })
    );
    assert_eq!(Prepared::native("shell", PathBuf::from("/bin/echo")), None);
}

#[tokio::test]
async fn no_source_answering_is_no_report() {
    assert!(read_first("x", &[], &BTreeMap::new()).await.is_none());
}

#[test]
fn a_cache_hands_back_what_it_holds_until_it_goes_stale() {
    let report = QuotaReport { agent: "x".to_string(), windows: Vec::new(), updated_at: None };
    let mut cache = QuotaCache::new();
    cache.store("x", Some(report.clone()));

    assert_eq!(cache.peek("x", Duration::from_secs(60)), Some(Some(report)));
    assert_eq!(cache.peek("x", Duration::from_nanos(1)), None);
    assert_eq!(cache.peek("otro", Duration::from_secs(60)), None);

    cache.invalidate();
    assert_eq!(cache.peek("x", Duration::from_secs(60)), None);
}
