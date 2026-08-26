use std::sync::Once;

use super::*;

static MOCK: Once = Once::new();

fn mocked() {
    MOCK.call_once(|| {
        keyring_core::set_default_store(keyring_core::mock::Store::new().expect("mock store"));
    });
}

fn provider(name: &str, env: Option<&str>) -> Provider {
    let mut provider =
        Provider::parse("name = \"stand-in\"\nlabel = \"Stand in\"\nkind = \"openai\"\n")
            .expect("parse");
    provider.name = name.to_owned();
    provider.env = env.map(str::to_owned);
    provider
}

#[test]
fn a_kept_key_comes_back_marked_as_kept() {
    mocked();
    keep("kept", "sk-live").expect("keep");
    let found = find(&provider("kept", None)).expect("find").expect("a key");
    assert_eq!(found.key, "sk-live");
    assert_eq!(found.from, Source::Keychain);
}

#[test]
fn a_provider_with_no_key_anywhere_finds_nothing() {
    mocked();
    assert_eq!(find(&provider("bare", None)).expect("find"), None);
}

#[test]
fn the_environment_wins_over_what_was_kept() {
    mocked();
    keep("shadowed", "sk-kept").expect("keep");
    let found = find(&provider("shadowed", Some("PATH"))).expect("find").expect("a key");
    assert_eq!(found.from, Source::Environment);
    assert_ne!(found.key, "sk-kept");
}

#[test]
fn an_environment_name_that_is_not_set_falls_back_to_the_keychain() {
    mocked();
    keep("fallback", "sk-kept").expect("keep");
    let found =
        find(&provider("fallback", Some("APEX_NOTHING_LIVES_HERE"))).expect("find").expect("a key");
    assert_eq!(found.from, Source::Keychain);
    assert_eq!(found.key, "sk-kept");
}

#[test]
fn forgetting_a_key_leaves_the_provider_bare() {
    mocked();
    keep("dropped", "sk-live").expect("keep");
    forget("dropped").expect("forget");
    assert_eq!(find(&provider("dropped", None)).expect("find"), None);
}

#[test]
fn two_providers_do_not_share_a_key() {
    mocked();
    keep("one", "sk-one").expect("keep");
    keep("two", "sk-two").expect("keep");
    assert_eq!(find(&provider("one", None)).expect("find").expect("a key").key, "sk-one");
    assert_eq!(find(&provider("two", None)).expect("find").expect("a key").key, "sk-two");
}

#[test]
fn a_key_is_kept_under_a_name_of_its_own() {
    assert_eq!(account("openai"), "provider:openai");
    assert_ne!(account("openai"), account("openrouter"));
}
