use super::*;

#[test]
fn a_buffer_under_capacity_replays_everything() {
    let mut ring = RingBuffer::new(64);
    ring.push(b"hello ");
    ring.push(b"world");
    assert_eq!(ring.snapshot(), Bytes::from_static(b"hello world"));
    assert_eq!(ring.len(), 11);
}

#[test]
fn an_empty_buffer_replays_nothing() {
    assert!(RingBuffer::new(64).is_empty());
    assert_eq!(RingBuffer::new(64).snapshot(), Bytes::new());
}

#[test]
fn overflow_drops_the_oldest_bytes_and_starts_at_a_line_boundary() {
    let mut ring = RingBuffer::new(16);
    ring.push(b"first line\nsecond line\nthird");
    let snapshot = ring.snapshot();
    assert!(snapshot.len() <= 16);
    assert!(!snapshot.contains(&b'\n') || snapshot.starts_with(b"third"));
}

#[test]
fn a_chunk_larger_than_capacity_keeps_only_its_tail() {
    let mut ring = RingBuffer::new(8);
    ring.push(b"0123456789abcdef");
    assert_eq!(ring.len(), 8);
    assert!(b"89abcdef".ends_with(&ring.snapshot()[..]));
}

#[test]
fn capacity_is_never_zero() {
    let mut ring = RingBuffer::new(0);
    ring.push(b"x");
    assert_eq!(ring.len(), 1);
}

#[test]
fn a_buffer_that_never_overflowed_keeps_its_leading_line() {
    let mut ring = RingBuffer::new(64);
    ring.push(b"first\nsecond");
    assert_eq!(ring.snapshot(), Bytes::from_static(b"first\nsecond"));
}
