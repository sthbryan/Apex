use super::*;

#[test]
fn every_editor_has_a_unique_id() {
    let mut ids: Vec<&str> = EDITORS.iter().map(|editor| editor.id).collect();
    ids.sort_unstable();
    let total = ids.len();
    ids.dedup();
    assert_eq!(ids.len(), total);
}

#[test]
fn a_bundle_is_found_next_to_the_home_directory() {
    let home = tempfile::tempdir().expect("tempdir");
    let spec = EDITORS
        .iter()
        .find(|editor| bundle(editor, Path::new("/nowhere")).is_none())
        .expect("an editor that is not installed system wide");
    let installed = home.path().join(format!("Applications/{}.app", spec.apps[0]));
    std::fs::create_dir_all(&installed).expect("bundle");

    let found = bundle(spec, home.path());
    if cfg!(target_os = "macos") {
        assert_eq!(found, Some(installed));
        assert!(is_bundle(&found.expect("path")));
    } else {
        assert!(found.is_none());
    }
}
