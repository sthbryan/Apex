use super::*;

const SAMPLE: &str = r#"{"response":{"groups":[
    {"displayName":"Gemini Models","buckets":[
        {"bucketId":"gemini-weekly","window":"weekly","remainingFraction":1,"resetTime":"2026-08-25T20:11:17Z"}]},
    {"displayName":"Claude and GPT models","buckets":[
        {"bucketId":"3p-weekly","window":"weekly","remainingFraction":0.25,"resetTime":"2026-08-25T20:11:17Z"}]}]}}"#;

#[test]
fn each_group_becomes_the_share_it_has_spent() {
    let payload: serde_json::Value = serde_json::from_str(SAMPLE).expect("payload");
    let report = parse("antigravity", &payload).expect("report");
    assert_eq!(report.windows.len(), 2);

    assert_eq!(report.windows[0].used_percent, 0);
    assert_eq!(report.windows[0].label.as_deref(), Some("1w"));
    assert_eq!(report.windows[0].reset_description.as_deref(), Some("Gemini Models"));
    assert_eq!(report.windows[0].resets_at.as_deref(), Some("2026-08-25T20:11:17Z"));

    assert_eq!(report.windows[1].used_percent, 75);
}

#[test]
fn the_tightest_bucket_speaks_for_its_group() {
    let raw = r#"{"response":{"groups":[{"displayName":"Mixed","buckets":[
        {"window":"weekly","remainingFraction":0.9},
        {"window":"weekly","remainingFraction":0.1}]}]}}"#;
    let payload: serde_json::Value = serde_json::from_str(raw).expect("payload");
    let report = parse("antigravity", &payload).expect("report");
    assert_eq!(report.windows[0].used_percent, 90);
}

#[test]
fn an_answer_without_groups_is_discarded() {
    let empty: serde_json::Value =
        serde_json::from_str(r#"{"response":{"groups":[]}}"#).expect("payload");
    assert!(parse("antigravity", &empty).is_none());

    let other: serde_json::Value = serde_json::from_str(r#"{"userStatus":{}}"#).expect("payload");
    assert!(parse("antigravity", &other).is_none());
}

#[test]
fn a_listening_line_gives_up_its_port() {
    assert_eq!(
        listening_ports_from("agy 99790 me 10u IPv4 0x39 0t0 TCP 127.0.0.1:53771 (LISTEN)"),
        vec![53771]
    );
    assert!(listening_ports_from("agy 99790 me 12u IPv4 0x39 0t0 TCP *:443 (LISTEN)").is_empty());
}

#[tokio::test]
#[ignore = "needs agy installed"]
async fn the_real_language_server_answers() {
    let env: BTreeMap<String, String> = std::env::vars().collect();
    let binary = std::path::PathBuf::from(std::env::var("AGY_BIN").expect("AGY_BIN"));
    println!("{:?}", read("antigravity", &binary, &env).await);
}
