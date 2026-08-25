use crate::client::spoken_version;

#[test]
fn the_refusal_names_the_protocol_the_daemon_speaks() {
    assert_eq!(spoken_version("daemon speaks v17, client speaks v18"), Some(17));
}

#[test]
fn a_refusal_about_nothing_in_particular_names_no_version() {
    assert_eq!(spoken_version("apexd is having a bad day"), None);
}

#[test]
fn a_word_that_only_looks_like_a_version_is_not_one() {
    assert_eq!(spoken_version("the daemon said very little"), None);
}

#[test]
fn a_two_digit_protocol_survives_the_comma() {
    assert_eq!(spoken_version("daemon speaks v104, client speaks v255"), Some(104));
}
