use super::*;

fn listed(ids: &[&str]) -> ModelList {
    ModelList::new(ids.iter().map(|id| rig_core::model::Model::from_id(*id)).collect())
}

#[test]
fn a_chat_model_is_kept() {
    assert!(useful("gpt-5"));
    assert!(useful("claude-opus-4-6"));
    assert!(useful("gemini-3-pro"));
    assert!(useful("qwen3-coder-480b"));
}

#[test]
fn the_models_that_cannot_code_are_left_out() {
    assert!(!useful("text-embedding-3-large"));
    assert!(!useful("whisper-1"));
    assert!(!useful("gpt-4o-transcribe"));
    assert!(!useful("omni-moderation-latest"));
    assert!(!useful("dall-e-3"));
    assert!(!useful("gpt-image-1"));
    assert!(!useful("imagen-4"));
    assert!(!useful("rerank-v3.5"));
    assert!(!useful("gpt-4o-audio-preview"));
    assert!(!useful("gpt-4o-realtime-preview"));
    assert!(!useful("llama-guard-4-12b"));
    assert!(!useful("sora-2"));
    assert!(!useful("tts-1-hd"));
}

#[test]
fn a_capitalised_name_is_read_the_same_way() {
    assert!(!useful("Text-Embedding-3-Large"));
    assert!(!useful("WHISPER-1"));
}

#[test]
fn a_model_with_no_name_at_all_is_left_out() {
    assert!(!useful(""));
    assert!(!useful("   "));
}

#[test]
fn a_listing_comes_back_sorted_and_without_repeats() {
    let shaped = shape(listed(&["gpt-5", "claude-opus-4-6", "gpt-5"]));
    let ids: Vec<&str> = shaped.iter().map(|model| model.id.as_str()).collect();
    assert_eq!(ids, vec!["claude-opus-4-6", "gpt-5"]);
}

#[test]
fn a_listing_drops_what_cannot_code_before_you_see_it() {
    let shaped = shape(listed(&["gpt-5", "text-embedding-3-large", "whisper-1"]));
    let ids: Vec<&str> = shaped.iter().map(|model| model.id.as_str()).collect();
    assert_eq!(ids, vec!["gpt-5"]);
}

#[test]
fn a_model_without_a_pretty_name_falls_back_to_its_id() {
    let shaped = shape(listed(&["gpt-5"]));
    assert_eq!(shaped[0].label, "gpt-5");
    assert_eq!(shaped[0].context, None);
}

#[test]
fn a_window_the_provider_reports_is_carried_along() {
    let mut model = rig_core::model::Model::new("gpt-5", "GPT-5");
    model.context_length = Some(400_000);
    let shaped = shape(ModelList::new(vec![model]));
    assert_eq!(shaped[0].label, "GPT-5");
    assert_eq!(shaped[0].context, Some(400_000));
}

#[test]
fn an_empty_listing_stays_empty() {
    assert!(shape(listed(&[])).is_empty());
}
