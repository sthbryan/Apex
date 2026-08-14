use bytes::Bytes;
use std::collections::VecDeque;

pub const DEFAULT_CAPACITY: usize = 512 * 1024;

pub struct RingBuffer {
    capacity: usize,
    data: VecDeque<u8>,
    overflowed: bool,
}

impl RingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self { capacity: capacity.max(1), data: VecDeque::new(), overflowed: false }
    }

    pub fn push(&mut self, chunk: &[u8]) {
        if chunk.len() >= self.capacity {
            self.data.clear();
            self.data.extend(&chunk[chunk.len() - self.capacity..]);
            self.overflowed = true;
            return;
        }

        let overflow = (self.data.len() + chunk.len()).saturating_sub(self.capacity);
        if overflow > 0 {
            self.data.drain(..overflow);
            self.overflowed = true;
        }
        self.data.extend(chunk);
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    pub fn snapshot(&self) -> Bytes {
        let (front, back) = self.data.as_slices();
        let mut joined = Vec::with_capacity(front.len() + back.len());
        joined.extend_from_slice(front);
        joined.extend_from_slice(back);
        Bytes::from(align_to_line(joined, self.overflowed))
    }
}

fn align_to_line(data: Vec<u8>, overflowed: bool) -> Vec<u8> {
    if !overflowed {
        return data;
    }
    match data.iter().position(|byte| *byte == b'\n') {
        Some(index) => data[index + 1..].to_vec(),
        None => data,
    }
}

#[cfg(test)]
mod tests {
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
}
