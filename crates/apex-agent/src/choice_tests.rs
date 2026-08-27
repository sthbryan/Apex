use super::*;

fn choice(provider: &str, model: &str) -> Choice {
    Choice { provider: provider.to_owned(), model: model.to_owned() }
}

#[test]
fn what_was_chosen_last_comes_back_next_time() {
    let dir = tempfile::tempdir().expect("dir");
    write(dir.path(), &choice("openai", "gpt-5")).expect("write");
    assert_eq!(read(dir.path()), Some(choice("openai", "gpt-5")));
}

#[test]
fn a_folder_with_nothing_chosen_yet_offers_nothing() {
    let dir = tempfile::tempdir().expect("dir");
    assert_eq!(read(dir.path()), None);
}

#[test]
fn a_folder_that_is_not_there_offers_nothing() {
    assert_eq!(read(Path::new("/nowhere/at/all")), None);
}

#[test]
fn choosing_again_replaces_what_was_there() {
    let dir = tempfile::tempdir().expect("dir");
    write(dir.path(), &choice("openai", "gpt-5")).expect("write");
    write(dir.path(), &choice("groq", "kimi-k2")).expect("write");
    assert_eq!(read(dir.path()), Some(choice("groq", "kimi-k2")));
}

#[test]
fn a_half_written_choice_counts_as_none() {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::write(dir.path().join("last.toml"), "provider = \"openai\"\nmodel = \"\"\n")
        .expect("write");
    assert_eq!(read(dir.path()), None);
}

#[test]
fn a_file_that_is_not_a_choice_at_all_counts_as_none() {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::write(dir.path().join("last.toml"), "this is not toml at all {").expect("write");
    assert_eq!(read(dir.path()), None);
}

#[test]
fn the_folder_is_made_when_it_is_not_there_yet() {
    let dir = tempfile::tempdir().expect("dir");
    let nested = dir.path().join("agent");
    write(&nested, &choice("openai", "gpt-5")).expect("write");
    assert!(nested.join("last.toml").exists());
}

#[test]
fn erasing_the_choice_leaves_nothing_behind_and_does_not_mind_being_asked_twice() {
    let dir = tempfile::tempdir().expect("dir");
    write(dir.path(), &Choice { provider: "minimax".to_owned(), model: "M3".to_owned() })
        .expect("write");
    assert!(read(dir.path()).is_some());

    erase(dir.path()).expect("erase");
    assert!(read(dir.path()).is_none());
    erase(dir.path()).expect("erase again");
}
