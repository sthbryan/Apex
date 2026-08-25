use super::*;

#[cfg(target_os = "macos")]
#[test]
fn the_busiest_accelerator_wins() {
    let raw = "  \"Device Utilization %\"=7\n  \"Renderer Utilization %\"=99\n  \"Device Utilization %\"=51\n";
    assert_eq!(parse_utilization(raw), Some(51.0));
}

#[cfg(target_os = "macos")]
#[test]
fn output_without_the_key_yields_nothing() {
    assert_eq!(parse_utilization("nothing useful"), None);
    assert_eq!(parse_utilization(""), None);
}

#[cfg(target_os = "macos")]
#[test]
fn a_malformed_value_is_skipped() {
    assert_eq!(parse_utilization("  \"Device Utilization %\"=abc\n"), None);
}

#[cfg(target_os = "linux")]
#[test]
fn nvidia_smi_output_is_parsed() {
    assert_eq!(parse_nvidia_smi_stdout(b"1\n"), Some(1.0));
    assert_eq!(parse_nvidia_smi_stdout(b"73\n"), Some(73.0));
}

#[cfg(target_os = "linux")]
#[test]
fn nvidia_smi_garbage_yields_nothing() {
    assert_eq!(parse_nvidia_smi_stdout(b""), None);
    assert_eq!(parse_nvidia_smi_stdout(b"[N/A]\n"), None);
}

#[cfg(target_os = "linux")]
#[test]
fn amdgpu_busy_percent_is_parsed() {
    assert_eq!(parse_busy_percent("42\n"), Some(42.0));
    assert_eq!(parse_busy_percent("garbage"), None);
}

#[test]
fn a_real_read_either_works_or_degrades() {
    if let Some(value) = read_gpu_utilization() {
        assert!((0.0..=100.0).contains(&value), "gpu fuera de rango: {value}");
    }
}
