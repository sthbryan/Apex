use super::*;

#[test]
fn only_http_and_https_are_reachable() {
    assert!(reachable("https://example.com").is_ok());
    assert!(reachable("http://example.com").is_ok());
    assert!(reachable("file:///etc/passwd").is_err());
    assert!(reachable("ftp://example.com").is_err());
}

#[test]
fn an_address_that_is_not_one_is_refused() {
    assert!(reachable("").is_err());
    assert!(reachable("just some words").is_err());
}

#[test]
fn text_answers_are_taken_and_pictures_are_not() {
    assert!(wordy("text/html; charset=utf-8"));
    assert!(wordy("application/json"));
    assert!(wordy("text/plain"));
    assert!(wordy(""));
    assert!(!wordy("image/png"));
    assert!(!wordy("application/pdf"));
}

#[test]
fn tags_are_taken_out_and_words_are_kept() {
    assert_eq!(strip("<p>hola <b>mundo</b></p>"), "hola mundo");
}

#[test]
fn scripts_and_styles_never_reach_the_model() {
    let html = "<html><head><style>body{color:red}</style></head><body>hola<script>alert(1)</script>chau</body></html>";
    let text = strip(html);
    assert!(text.contains("hola"));
    assert!(text.contains("chau"));
    assert!(!text.contains("alert"));
    assert!(!text.contains("color:red"));
}

#[test]
fn a_block_that_is_never_closed_swallows_the_rest_instead_of_leaking_it() {
    assert_eq!(strip("hola<script>alert(1)"), "hola");
}

#[test]
fn the_usual_escapes_are_read_back() {
    assert_eq!(
        strip("<p>a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;</p>"),
        "a & b <c> \"d\" 'e'"
    );
}

#[test]
fn runs_of_blank_space_are_squeezed() {
    assert_eq!(strip("<p>hola     mundo</p>\n\n\n\n<p>chau</p>"), "hola mundo\n\nchau");
}

#[test]
fn a_page_is_labelled_with_where_it_came_from() {
    let spelled = spell("https://x.dev", 200, "text/html", "<p>hola</p>");
    assert_eq!(spelled, "https://x.dev, 200\nhola\n");
}

#[test]
fn json_comes_back_as_it_was_sent() {
    let spelled = spell("https://x.dev/api", 200, "application/json", "{\"a\":1}");
    assert_eq!(spelled, "https://x.dev/api, 200\n{\"a\":1}\n");
}

#[test]
fn a_page_with_nothing_readable_says_so() {
    let spelled = spell("https://x.dev", 204, "text/html", "<html><body></body></html>");
    assert_eq!(spelled, "https://x.dev, 204, nothing readable came back\n");
}

#[test]
fn a_failing_page_still_comes_back_with_its_code() {
    let spelled = spell("https://x.dev", 404, "text/plain", "not found");
    assert!(spelled.contains("404"));
    assert!(spelled.contains("not found"));
}

#[test]
fn a_very_long_page_is_cut_and_says_so() {
    let long = "x".repeat(MOST_TEXT + 100);
    let cut = clipped(&long);
    assert!(cut.ends_with("… cut here …"));
    assert!(cut.chars().count() < long.chars().count() + 20);
}

#[test]
fn a_page_right_at_the_cap_is_not_cut() {
    let exact = "x".repeat(MOST_TEXT);
    assert_eq!(clipped(&exact), exact);
}
