use super::*;

const THREE: &str = "uno\ndos\ntres\n";

#[test]
fn a_whole_file_says_how_many_lines_it_has() {
    assert_eq!(cut("a.txt", THREE, None, None), "a.txt, 3 lines\nuno\ndos\ntres\n");
}

#[test]
fn a_slice_says_which_lines_it_is() {
    assert_eq!(cut("a.txt", THREE, Some(2), Some(1)), "a.txt, lines 2 to 2 of 3\ndos\n");
}

#[test]
fn a_limit_past_the_end_stops_at_the_end() {
    assert_eq!(cut("a.txt", THREE, Some(2), Some(99)), "a.txt, lines 2 to 3 of 3\ndos\ntres\n");
}

#[test]
fn line_zero_is_read_as_the_first_line() {
    assert_eq!(cut("a.txt", THREE, Some(0), Some(1)), "a.txt, lines 1 to 1 of 3\nuno\n");
}

#[test]
fn asking_past_the_end_says_so_instead_of_coming_back_empty() {
    assert_eq!(
        cut("a.txt", THREE, Some(9), None),
        "a.txt has 3 lines, so there is nothing at line 9\n"
    );
}

#[test]
fn an_empty_file_is_read_as_empty() {
    assert_eq!(cut("a.txt", "", None, None), "a.txt is empty\n");
    assert_eq!(cut("a.txt", "", Some(4), None), "a.txt is empty\n");
}

#[test]
fn a_huge_limit_is_capped_so_the_context_survives() {
    let many: String = (0..3000).map(|line| format!("line {line}\n")).collect();
    let out = cut("big.txt", &many, None, Some(9_000));
    assert!(out.starts_with("big.txt, lines 1 to 2000 of 3000\n"));
}

#[test]
fn a_file_longer_than_the_cap_is_cut_even_with_no_limit_asked() {
    let many: String = (0..3000).map(|line| format!("line {line}\n")).collect();
    let out = cut("big.txt", &many, None, None);
    assert!(out.starts_with("big.txt, lines 1 to 2000 of 3000\n"));
}
