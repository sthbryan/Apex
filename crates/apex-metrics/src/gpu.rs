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

#[cfg(target_os = "linux")]
pub fn read_gpu_utilization() -> Option<f32> {
    read_nvidia_utilization().or_else(read_amdgpu_utilization)
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn read_gpu_utilization() -> Option<f32> {
    None
}

#[cfg(target_os = "macos")]
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

#[cfg(target_os = "linux")]
fn read_nvidia_utilization() -> Option<f32> {
    let output = std::process::Command::new("nvidia-smi")
        .args(["--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    parse_nvidia_smi_stdout(&output.stdout)
}

#[cfg(target_os = "linux")]
fn parse_nvidia_smi_stdout(stdout: &[u8]) -> Option<f32> {
    String::from_utf8_lossy(stdout).lines().next()?.trim().parse().ok()
}

#[cfg(target_os = "linux")]
fn read_amdgpu_utilization() -> Option<f32> {
    for entry in std::fs::read_dir("/sys/class/drm").ok()?.filter_map(Result::ok) {
        let raw = std::fs::read_to_string(entry.path().join("device/gpu_busy_percent")).ok();
        if let Some(value) = raw.and_then(|raw| parse_busy_percent(&raw)) {
            return Some(value);
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn parse_busy_percent(raw: &str) -> Option<f32> {
    raw.trim().parse().ok()
}

#[cfg(test)]
#[path = "gpu_tests.rs"]
mod tests;
