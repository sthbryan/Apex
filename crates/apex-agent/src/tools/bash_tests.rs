use super::*;

#[test]
fn a_command_that_worked_says_so() {
    assert_eq!(spell(Some(0), "hola\n"), "ok\nhola\n");
}

#[test]
fn a_command_that_failed_carries_its_code() {
    assert_eq!(spell(Some(2), "nope\n"), "exit 2\nnope\n");
}

#[test]
fn a_command_killed_by_a_signal_says_that_instead_of_a_code() {
    assert_eq!(spell(None, ""), "stopped by a signal, printed nothing\n");
}

#[test]
fn a_quiet_command_says_it_printed_nothing() {
    assert_eq!(spell(Some(0), "   \n"), "ok, printed nothing\n");
}

#[test]
fn short_output_comes_back_whole() {
    assert_eq!(clipped("uno\ndos"), "uno\ndos");
}

#[test]
fn trailing_blank_lines_are_trimmed_off() {
    assert_eq!(clipped("uno\n\n\n"), "uno");
}

#[test]
fn long_output_is_cut_in_the_middle_and_says_so() {
    let long = "x".repeat(MOST_OUTPUT + 500);
    let cut = clipped(&long);
    assert!(cut.contains("500 characters in the middle"));
    assert!(cut.chars().count() < long.chars().count());
    assert!(cut.starts_with('x'));
    assert!(cut.ends_with('x'));
}

#[test]
fn output_right_at_the_cap_is_not_cut() {
    let exact = "x".repeat(MOST_OUTPUT);
    assert_eq!(clipped(&exact), exact);
}
