use apex_agent::ProviderKind;

use super::*;

fn provider(name: &str, env: Option<&str>, keyless: bool) -> Provider {
    Provider {
        name: name.to_owned(),
        label: name.to_owned(),
        kind: ProviderKind::Openai,
        base_url: None,
        env: env.map(str::to_owned),
        keyless,
    }
}

#[test]
fn a_provider_holding_a_kept_key_says_so() {
    let openai = provider("openai", Some("OPENAI_API_KEY"), false);
    assert_eq!(spell_holding(&openai, Some(Source::Keychain)), "kept");
}

#[test]
fn a_key_coming_from_the_environment_names_the_variable() {
    let openai = provider("openai", Some("OPENAI_API_KEY"), false);
    assert_eq!(spell_holding(&openai, Some(Source::Environment)), "from OPENAI_API_KEY");
}

#[test]
fn a_key_from_an_unnamed_variable_still_says_where_it_came_from() {
    let mine = provider("mine", None, false);
    assert_eq!(spell_holding(&mine, Some(Source::Environment)), "from the environment");
}

#[test]
fn a_provider_with_nothing_kept_asks_for_a_key() {
    let openai = provider("openai", Some("OPENAI_API_KEY"), false);
    assert_eq!(spell_holding(&openai, None), "no key yet");
}

#[test]
fn a_local_provider_with_nothing_kept_is_not_missing_anything() {
    let ollama = provider("ollama", None, true);
    assert_eq!(spell_holding(&ollama, None), "no key needed");
}

#[test]
fn the_listing_lines_up_on_the_longest_name() {
    let openai = provider("openai", None, false);
    let openrouter = provider("openrouter", None, false);
    let spelled = spell_keys(&[(&openai, Some(Source::Keychain)), (&openrouter, None)]);
    assert_eq!(spelled, "openai      kept\nopenrouter  no key yet\n");
}

#[test]
fn an_empty_listing_spells_nothing() {
    assert_eq!(spell_keys(&[]), "");
}

#[test]
fn the_known_names_are_offered_when_one_is_wrong() {
    let set = ProviderSet::builtin().expect("builtin");
    let names = spell_names(&set);
    assert!(names.contains("openai"));
    assert!(names.contains(", "));
}
