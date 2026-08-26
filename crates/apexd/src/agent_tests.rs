use super::*;

fn asked(provider: Option<&str>, model: Option<&str>) -> Run {
    Run { provider: provider.map(str::to_owned), model: model.map(str::to_owned), wrong: None }
}

fn last(provider: &str, model: &str) -> Choice {
    Choice { provider: provider.to_owned(), model: model.to_owned() }
}

#[test]
fn what_you_type_is_what_you_get() {
    let picked = pick(&asked(Some("groq"), Some("kimi-k2")), None).expect("picked");
    assert_eq!(picked, last("groq", "kimi-k2"));
}

#[test]
fn with_nothing_typed_and_nothing_remembered_it_asks_for_a_provider() {
    let complaint = pick(&asked(None, None), None).expect_err("no provider");
    assert!(complaint.contains("needs a provider"));
}

#[test]
fn with_nothing_typed_it_takes_what_you_used_last() {
    let picked = pick(&asked(None, None), Some(&last("openai", "gpt-5"))).expect("picked");
    assert_eq!(picked, last("openai", "gpt-5"));
}

#[test]
fn naming_only_the_provider_keeps_the_model_you_used_on_it() {
    let picked =
        pick(&asked(Some("openai"), None), Some(&last("openai", "gpt-5"))).expect("picked");
    assert_eq!(picked, last("openai", "gpt-5"));
}

#[test]
fn changing_provider_does_not_carry_the_other_ones_model_over() {
    let complaint =
        pick(&asked(Some("groq"), None), Some(&last("openai", "gpt-5"))).expect_err("no model");
    assert!(complaint.contains("groq needs a model"));
    assert!(complaint.contains("apex auth models groq"));
}

#[test]
fn naming_only_the_model_keeps_the_provider_you_used_last() {
    let picked =
        pick(&asked(None, Some("gpt-5-mini")), Some(&last("openai", "gpt-5"))).expect("picked");
    assert_eq!(picked, last("openai", "gpt-5-mini"));
}

#[test]
fn a_provider_with_no_model_anywhere_says_where_to_look() {
    let complaint = pick(&asked(Some("openai"), None), None).expect_err("no model");
    assert!(complaint.contains("openai needs a model"));
}
