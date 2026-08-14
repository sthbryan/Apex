#[cfg(target_os = "macos")]
pub fn read_gpu_utilization() -> Option<f32> {
    let output = std::process::Command::new("ioreg")
        .args(["-r", "-d", "1", "-w", "0", "-c", "IOAccelerator"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    parse_utilization(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(not(target_os = "macos"))]
pub fn read_gpu_utilization() -> Option<f32> {
    None
}

fn parse_utilization(raw: &str) -> Option<f32> {
    const KEY: &str = "\"Device Utilization %\"=";

    raw.lines()
        .filter_map(|line| {
            let index = line.find(KEY)?;
            let tail = &line[index + KEY.len()..];
            let digits: String = tail.chars().take_while(char::is_ascii_digit).collect();
            digits.parse::<f32>().ok()
        })
        .fold(None, |best: Option<f32>, value| Some(best.map_or(value, |top| top.max(value))))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_busiest_accelerator_wins() {
        let raw = "  \"Device Utilization %\"=7\n  \"Renderer Utilization %\"=99\n  \"Device Utilization %\"=51\n";
        assert_eq!(parse_utilization(raw), Some(51.0));
    }

    #[test]
    fn output_without_the_key_yields_nothing() {
        assert_eq!(parse_utilization("sin nada util"), None);
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
}
