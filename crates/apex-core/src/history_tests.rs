use super::*;

fn profile(path: &str, resume: &str) -> AgentProfile {
    AgentProfile::parse(&format!(
        "name = \"claude\"\ncommand = \"claude\"\n\
         [history]\nsource = \"dir\"\npath = \"{path}\"\nresume_args = [\"--resume\", \"{resume}\"]\n"
    ))
    .expect("profile")
}

#[test]
fn a_profile_without_history_yields_nothing() {
    let bare = AgentProfile::parse("name = \"sh\"\ncommand = \"sh\"\n").expect("profile");
    assert!(read_history(&bare, Path::new("/tmp"), Path::new("/tmp")).is_empty());
}

#[test]
fn a_missing_directory_yields_nothing_instead_of_failing() {
    let profile = profile("~/no/such/{project_slug}", "{session_id}");
    assert!(read_history(&profile, Path::new("/tmp/x"), Path::new("/tmp")).is_empty());
}

#[test]
fn sessions_are_read_newest_first_with_their_label() {
    let home = tempfile::tempdir().expect("home");
    let slug = project_slug(Path::new("/Users/x/code"));
    let dir = home.path().join("sessions").join(&slug);
    std::fs::create_dir_all(&dir).expect("mkdir");

    std::fs::write(
        dir.join("aaa-111.jsonl"),
        "{\"type\":\"user\",\"content\":\"fix the login bug\"}\n",
    )
    .expect("write");
    std::thread::sleep(std::time::Duration::from_millis(1100));
    std::fs::write(dir.join("bbb-222.jsonl"), "{\"content\":\"write tests\"}\n")
        .expect("write");

    let profile = profile("~/sessions/{project_slug}", "{session_id}");
    let found = read_history(&profile, Path::new("/Users/x/code"), home.path());

    assert_eq!(found.len(), 2);
    assert_eq!(found[0].session_id, "bbb-222");
    assert_eq!(found[0].label.as_deref(), Some("write tests"));
    assert_eq!(found[1].session_id, "aaa-111");
    assert_eq!(found[1].label.as_deref(), Some("fix the login bug"));
    assert_eq!(found[0].agent, "claude");
}

#[test]
fn a_session_without_readable_content_still_appears() {
    let home = tempfile::tempdir().expect("home");
    let dir = home.path().join("sessions").join(project_slug(Path::new("/p")));
    std::fs::create_dir_all(&dir).expect("mkdir");
    std::fs::write(dir.join("ccc-333.jsonl"), "this is not json\n").expect("write");

    let found =
        read_history(&profile("~/sessions/{project_slug}", "{session_id}"), Path::new("/p"), home.path());
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].label, None);
}

#[test]
fn a_long_label_is_shortened_to_one_line() {
    let long = "word ".repeat(80);
    assert!(shorten(&long).chars().count() <= LABEL_LIMIT + 1);
    assert_eq!(shorten("  several\n  lines  "), "several lines");
}

#[test]
fn sessions_stored_as_directories_take_their_label_from_a_shared_index() {
    let home = tempfile::tempdir().expect("home");
    let dir = home.path().join("sessions").join(project_encoded(Path::new("/Users/x/code")));
    std::fs::create_dir_all(dir.join("019fba90-7acb")).expect("mkdir");
    std::fs::create_dir_all(dir.join("019fba91-0000")).expect("mkdir");
    std::fs::write(
        dir.join("prompt_history.jsonl"),
        "{\"session_id\":\"019fba90-7acb\",\"prompt\":\"fix the greeting\"}\n\
         {\"session_id\":\"019fba90-7acb\",\"prompt\":\"and now something else\"}\n",
    )
    .expect("write");

    let profile = AgentProfile::parse(
        "name = \"grok\"\ncommand = \"grok\"\n\
         [history]\nsource = \"dir\"\n\
         path = \"~/sessions/{project_encoded}\"\n\
         entries = \"dirs\"\n\
         label_file = \"prompt_history.jsonl\"\n\
         label_id_key = \"session_id\"\n\
         label_key = \"prompt\"\n\
         resume_args = [\"--resume\", \"{session_id}\"]\n",
    )
    .expect("profile");

    let found = read_history(&profile, Path::new("/Users/x/code"), home.path());
    assert_eq!(found.len(), 2, "both session folders should appear");

    let labelled = found.iter().find(|entry| entry.session_id == "019fba90-7acb").expect("session");
    assert_eq!(labelled.label.as_deref(), Some("fix the greeting"));

    let bare = found.iter().find(|entry| entry.session_id == "019fba91-0000").expect("session");
    assert_eq!(bare.label, None);
}

#[test]
fn the_encoded_project_path_matches_the_grok_layout() {
    assert_eq!(
        project_encoded(Path::new("/Users/sthbryan/Documents/Codes/Kakebo")),
        "%2FUsers%2Fsthbryan%2FDocuments%2FCodes%2FKakebo"
    );
}

#[test]
fn the_project_slug_matches_the_claude_layout() {
    assert_eq!(
        project_slug(Path::new("/Users/sthbryan/Documents/Codes/Apex")),
        "-Users-sthbryan-Documents-Codes-Apex"
    );
}

#[test]
fn resume_args_substitute_the_session_id() {
    let profile = profile("~/x", "{session_id}");
    assert_eq!(
        resume_args(&profile, "abc-123"),
        Some(vec!["--resume".to_string(), "abc-123".to_string()])
    );
}

#[test]
fn a_profile_without_resume_args_cannot_be_resumed() {
    let bare = AgentProfile::parse("name = \"sh\"\ncommand = \"sh\"\n").expect("profile");
    assert_eq!(resume_args(&bare, "abc"), None);
}
