use super::*;

#[test]
fn the_busiest_accelerator_wins() {
    let raw = "  \"Device Utilization %\"=7\n  \"Renderer Utilization %\"=99\n  \"Device Utilization %\"=51\n";
    assert_eq!(parse_utilization(raw), Some(51.0));
}

#[test]
fn output_without_the_key_yields_nothing() {
    assert_eq!(parse_utilization("nothing useful"), None);
    assert_eq!(parse_utilization(""), None);
}

#[test]
fn a_malformed_value_is_skipped() {
    assert_eq!(parse_utilization("  \"Device Utilization %\"=abc\n"), None);
}

#[test]
fn a_real_read_either_works_or_degrades() {
    if let Some(value) = read_gpu_utilization() {
        assert!((0.0..=100.0).contains(&value), "gpu fuera de rango: {value}");
    }
}
