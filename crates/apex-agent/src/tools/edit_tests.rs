use super::*;

#[test]
fn one_match_is_replaced() {
    let (changed, times) = swap("uno dos tres", "dos", "DOS", false).expect("swap");
    assert_eq!(changed, "uno DOS tres");
    assert_eq!(times, 1);
}

#[test]
fn text_that_is_not_there_is_refused() {
    let why = swap("uno dos", "cuatro", "x", false).expect_err("missing");
    assert!(why.contains("does not have that text"));
}

#[test]
fn several_matches_are_refused_unless_you_meant_it() {
    let why = swap("dos dos dos", "dos", "x", false).expect_err("many");
    assert!(why.contains("3 times"));
    assert!(why.contains("pass all"));
}

#[test]
fn several_matches_go_through_when_you_did_mean_it() {
    let (changed, times) = swap("dos dos dos", "dos", "x", true).expect("swap");
    assert_eq!(changed, "x x x");
    assert_eq!(times, 3);
}

#[test]
fn replacing_nothing_is_refused() {
    assert!(swap("uno", "", "x", false).is_err());
}

#[test]
fn replacing_text_with_itself_is_refused() {
    let why = swap("uno dos", "dos", "dos", false).expect_err("same");
    assert!(why.contains("same text twice"));
}

#[test]
fn only_the_first_match_moves_when_there_is_only_one() {
    let (changed, _) = swap("a\nb\nc\n", "b\n", "B\n", false).expect("swap");
    assert_eq!(changed, "a\nB\nc\n");
}

#[test]
fn replacing_with_nothing_takes_the_text_out() {
    let (changed, times) = swap("uno dos tres", " dos", "", false).expect("swap");
    assert_eq!(changed, "uno tres");
    assert_eq!(times, 1);
}
