use super::*;

#[test]
fn with_no_file_the_usual_numbers_apply() {
    let dir = tempfile::tempdir().expect("dir");
    let settings = read(dir.path());
    assert_eq!(settings.warns_at(), Some(50));
    assert_eq!(settings.compacts_at(), Some(80));
    assert!(settings.windows.is_empty());
}

#[test]
fn a_folder_that_is_not_there_uses_the_usual_numbers() {
    assert_eq!(read(Path::new("/nowhere/at/all")), Settings::default());
}

#[test]
fn your_own_numbers_win() {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::write(dir.path().join("settings.toml"), "warn_at = 70\ncompact_at = 90\n")
        .expect("write");
    let settings = read(dir.path());
    assert_eq!(settings.warns_at(), Some(70));
    assert_eq!(settings.compacts_at(), Some(90));
}

#[test]
fn setting_only_one_of_them_leaves_the_other_alone() {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::write(dir.path().join("settings.toml"), "warn_at = 70\n").expect("write");
    let settings = read(dir.path());
    assert_eq!(settings.warns_at(), Some(70));
    assert_eq!(settings.compacts_at(), Some(80));
}

#[test]
fn zero_turns_the_warning_off_and_the_risk_is_yours() {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::write(dir.path().join("settings.toml"), "warn_at = 0\ncompact_at = 0\n")
        .expect("write");
    let settings = read(dir.path());
    assert_eq!(settings.warns_at(), None);
    assert_eq!(settings.compacts_at(), None);
}

#[test]
fn a_number_past_a_hundred_counts_as_off_rather_than_never_firing() {
    let settings = Settings { warn_at: 140, compact_at: 200, ..Settings::default() };
    assert_eq!(settings.warns_at(), None);
    assert_eq!(settings.compacts_at(), None);
}

#[test]
fn a_window_can_be_set_for_a_model_nobody_knows() {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::write(dir.path().join("settings.toml"), "[windows]\n\"my-own-model\" = 32000\n")
        .expect("write");
    let settings = read(dir.path());
    assert_eq!(settings.window_for("my-own-model"), Some(32_000));
    assert_eq!(settings.window_for("gpt-5"), None);
}

#[test]
fn a_broken_file_falls_back_instead_of_stopping_everything() {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::write(dir.path().join("settings.toml"), "warn_at = \"mucho\"\n").expect("write");
    assert_eq!(read(dir.path()), Settings::default());
}
