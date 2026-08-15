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
#[path = "ring_tests.rs"]
mod tests;
