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
#[path = "gpu_tests.rs"]
mod tests;
