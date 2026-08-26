use std::sync::Once;

use super::*;

static MOCK: Once = Once::new();

fn mocked() {
    MOCK.call_once(|| {
        keyring_core::set_default_store(keyring_core::mock::Store::new().expect("mock store"));
    });
}

#[test]
fn a_secret_comes_back_the_way_it_went_in() {
    mocked();
    remember("round-trip", "sk-live").expect("remember");
    assert_eq!(recall("round-trip").expect("recall"), Some("sk-live".to_owned()));
}

#[test]
fn a_secret_nobody_kept_is_missing_and_not_a_failure() {
    mocked();
    assert_eq!(recall("never-kept").expect("recall"), None);
}

#[test]
fn keeping_it_twice_leaves_the_newer_one() {
    mocked();
    remember("twice", "old").expect("remember");
    remember("twice", "new").expect("remember");
    assert_eq!(recall("twice").expect("recall"), Some("new".to_owned()));
}

#[test]
fn forgetting_takes_it_away() {
    mocked();
    remember("gone", "sk-live").expect("remember");
    forget("gone").expect("forget");
    assert_eq!(recall("gone").expect("recall"), None);
}

#[test]
fn forgetting_what_was_never_there_is_quiet() {
    mocked();
    forget("never-there").expect("forget");
}

#[test]
fn a_blank_secret_is_refused_instead_of_stored() {
    mocked();
    assert!(remember("blank", "").is_err());
    assert!(remember("blank", "   ").is_err());
    assert_eq!(recall("blank").expect("recall"), None);
}

#[test]
fn a_secret_without_a_name_is_refused() {
    mocked();
    assert!(remember("", "sk-live").is_err());
    assert!(recall("  ").is_err());
    assert!(forget("").is_err());
}
