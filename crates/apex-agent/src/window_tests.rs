use super::*;

#[test]
fn the_models_we_know_have_a_size() {
    assert_eq!(guess("gpt-5"), Some(400_000));
    assert_eq!(guess("claude-opus-4-6"), Some(200_000));
    assert_eq!(guess("gemini-3-pro"), Some(1_048_576));
}

#[test]
fn a_model_nobody_listed_has_no_size_rather_than_a_made_up_one() {
    assert_eq!(guess("my-own-model"), None);
    assert_eq!(guess(""), None);
}

#[test]
fn the_name_is_read_without_caring_about_case() {
    assert_eq!(guess("GPT-5"), guess("gpt-5"));
}

#[test]
fn a_more_exact_name_wins_over_a_looser_one() {
    assert_eq!(guess("gpt-4o-mini"), Some(128_000));
    assert_ne!(guess("gpt-4.1"), guess("gpt-4o"));
}

#[test]
fn how_full_is_a_percentage_of_the_window() {
    assert_eq!(how_full(50, Some(100)), Some(50));
    assert_eq!(how_full(0, Some(100)), Some(0));
    assert_eq!(how_full(100, Some(100)), Some(100));
}

#[test]
fn going_over_the_window_still_reads_as_full_and_not_more() {
    assert_eq!(how_full(400, Some(100)), Some(100));
}

#[test]
fn with_no_window_there_is_no_percentage_to_give() {
    assert_eq!(how_full(50, None), None);
    assert_eq!(how_full(50, Some(0)), None);
}

#[test]
fn a_big_window_does_not_overflow_the_sum() {
    assert_eq!(how_full(500_000, Some(1_000_000)), Some(50));
    assert_eq!(how_full(u64::from(u32::MAX), Some(u32::MAX)), Some(100));
}
