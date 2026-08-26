use super::*;

fn write(dir: &Path, name: &str, raw: &str) {
    std::fs::write(dir.join(name), raw).expect("write");
}

#[test]
fn the_builtin_list_holds_together() {
    let set = ProviderSet::builtin().expect("builtin");
    assert!(set.len() >= 10);
    assert_eq!(set.get("openai").expect("openai").kind, ProviderKind::Openai);
    assert_eq!(set.get("anthropic").expect("anthropic").kind, ProviderKind::Anthropic);
    assert_eq!(
        set.get("openrouter").expect("openrouter").base_url.as_deref(),
        Some("https://openrouter.ai/api/v1")
    );
}

#[test]
fn a_local_provider_needs_no_key() {
    let set = ProviderSet::builtin().expect("builtin");
    assert!(set.get("ollama").expect("ollama").keyless);
    assert!(!set.get("openai").expect("openai").keyless);
}

#[test]
fn a_compatible_provider_without_a_base_url_is_refused() {
    let raw = "name = \"mine\"\nlabel = \"Mine\"\nkind = \"compatible\"\n";
    assert!(Provider::parse(raw).is_err());
}

#[test]
fn a_provider_without_a_name_is_refused() {
    let raw = "name = \"  \"\nlabel = \"Mine\"\nkind = \"openai\"\n";
    assert!(Provider::parse(raw).is_err());
}

#[test]
fn a_named_provider_with_a_base_url_is_taken() {
    let raw =
        "name = \"mine\"\nlabel = \"Mine\"\nkind = \"compatible\"\nbase_url = \"http://here/v1\"\n";
    let provider = Provider::parse(raw).expect("parse");
    assert_eq!(provider.name, "mine");
    assert_eq!(provider.base_url.as_deref(), Some("http://here/v1"));
    assert!(!provider.keyless);
}

#[test]
fn a_folder_of_toml_files_joins_the_builtin_ones() {
    let dir = tempfile::tempdir().expect("dir");
    write(
        dir.path(),
        "mine.toml",
        "name = \"mine\"\nlabel = \"Mine\"\nkind = \"compatible\"\nbase_url = \"http://here/v1\"\n",
    );
    let set = ProviderSet::load(dir.path()).expect("load");
    assert_eq!(set.get("mine").expect("mine").label, "Mine");
    assert!(set.get("openai").is_some());
}

#[test]
fn a_file_can_move_a_builtin_provider_elsewhere() {
    let dir = tempfile::tempdir().expect("dir");
    write(
        dir.path(),
        "ollama.toml",
        "name = \"ollama\"\nlabel = \"Ollama\"\nkind = \"compatible\"\nbase_url = \"http://box:11434/v1\"\nkeyless = true\n",
    );
    let set = ProviderSet::load(dir.path()).expect("load");
    assert_eq!(set.get("ollama").expect("ollama").base_url.as_deref(), Some("http://box:11434/v1"));
    assert_eq!(set.len(), ProviderSet::builtin().expect("builtin").len());
}

#[test]
fn a_broken_file_stops_the_load_instead_of_being_skipped() {
    let dir = tempfile::tempdir().expect("dir");
    write(dir.path(), "bad.toml", "name = \"bad\"\nlabel = \"Bad\"\nkind = \"compatible\"\n");
    assert!(ProviderSet::load(dir.path()).is_err());
}

#[test]
fn a_folder_that_is_not_there_leaves_the_builtin_ones_alone() {
    let set = ProviderSet::load(Path::new("/nowhere/at/all")).expect("load");
    assert_eq!(set.len(), ProviderSet::builtin().expect("builtin").len());
}

#[test]
fn files_that_are_not_toml_are_left_where_they_are() {
    let dir = tempfile::tempdir().expect("dir");
    write(dir.path(), "notes.txt", "this is not a provider");
    let set = ProviderSet::load(dir.path()).expect("load");
    assert_eq!(set.len(), ProviderSet::builtin().expect("builtin").len());
}

#[test]
fn a_blank_key_counts_as_no_key() {
    assert_eq!(usable(Some("sk-live".to_owned())), Some("sk-live".to_owned()));
    assert_eq!(usable(Some("   ".to_owned())), None);
    assert_eq!(usable(Some(String::new())), None);
    assert_eq!(usable(None), None);
}

#[test]
fn a_provider_reads_its_key_from_the_environment() {
    let mut provider =
        Provider::parse("name = \"mine\"\nlabel = \"Mine\"\nkind = \"openai\"\n").expect("parse");
    assert_eq!(provider.key_from_env(), None);

    provider.env = Some("PATH".to_owned());
    assert!(provider.key_from_env().is_some());

    provider.env = Some("APEX_NOTHING_LIVES_HERE".to_owned());
    assert_eq!(provider.key_from_env(), None);
}

#[test]
fn dialling_without_a_key_says_so_before_any_request() {
    let provider =
        Provider::parse("name = \"mine\"\nlabel = \"Mine\"\nkind = \"openai\"\n").expect("parse");
    assert!(provider.dial("").is_err());
    assert!(provider.dial("  ").is_err());
    assert!(provider.dial("sk-live").is_ok());
}

#[test]
fn a_local_provider_dials_with_no_key_at_all() {
    let set = ProviderSet::builtin().expect("builtin");
    assert!(set.get("ollama").expect("ollama").dial("").is_ok());
}
