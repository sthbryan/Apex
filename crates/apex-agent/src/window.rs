const KNOWN: &[(&str, u32)] = &[
    ("gpt-4.1", 1_047_576),
    ("gpt-4o", 128_000),
    ("gpt-5", 400_000),
    ("o3", 200_000),
    ("o4", 200_000),
    ("claude", 200_000),
    ("gemini", 1_048_576),
    ("grok", 131_072),
    ("deepseek", 128_000),
    ("kimi", 200_000),
    ("glm", 200_000),
    ("qwen", 128_000),
    ("llama", 128_000),
    ("mistral", 128_000),
];

pub fn guess(model: &str) -> Option<u32> {
    let model = model.to_lowercase();
    KNOWN.iter().find(|(mark, _)| model.contains(mark)).map(|(_, size)| *size)
}

pub fn how_full(filled: u64, window: Option<u32>) -> Option<u8> {
    let window = u64::from(window?);
    if window == 0 {
        return None;
    }
    Some(u8::try_from((filled * 100 / window).min(100)).unwrap_or(100))
}

#[cfg(test)]
#[path = "window_tests.rs"]
mod tests;
