use super::*;

#[test]
fn a_served_url_is_picked_up() {
    let mut scanner = UrlScanner::new();
    assert_eq!(
        scanner.scan(b"  \x1b[32m>\x1b[0m  Local:   http://localhost:5173/\n"),
        Some("http://localhost:5173".to_owned())
    );
}

#[test]
fn the_wildcard_host_becomes_loopback() {
    let mut scanner = UrlScanner::new();
    assert_eq!(
        scanner.scan(b"Listening on http://0.0.0.0:8080\n"),
        Some("http://127.0.0.1:8080".to_owned())
    );
}

#[test]
fn a_spoken_port_is_a_last_resort() {
    let mut scanner = UrlScanner::new();
    assert_eq!(
        scanner.scan(b"serving on port 3000 now\n"),
        Some("http://localhost:3000".to_owned())
    );
}

#[test]
fn a_marker_beats_a_spoken_port() {
    let mut scanner = UrlScanner::new();
    assert_eq!(
        scanner.scan(b"using port 3000\nready at http://localhost:5173\n"),
        Some("http://localhost:5173".to_owned())
    );
}

#[test]
fn nothing_is_reported_twice() {
    let mut scanner = UrlScanner::new();
    assert!(scanner.scan(b"ready at http://localhost:5173\n").is_some());
    assert_eq!(scanner.scan(b"reloaded in 12ms\n"), None);
    assert_eq!(scanner.scan(b"ready at http://localhost:5173\n"), None);
}

#[test]
fn a_url_split_across_chunks_still_lands() {
    let mut scanner = UrlScanner::new();
    assert_eq!(scanner.scan(b"  Local:   http://local"), None);
    assert_eq!(scanner.scan(b"host:4321/\n"), Some("http://localhost:4321".to_owned()));
}

#[test]
fn plain_output_says_nothing() {
    let mut scanner = UrlScanner::new();
    assert_eq!(scanner.scan(b"compiled successfully\n"), None);
}
