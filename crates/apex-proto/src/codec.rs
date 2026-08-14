use bytes::{Buf, BufMut, Bytes, BytesMut};
use serde::Serialize;
use serde::de::DeserializeOwned;
use tokio_util::codec::{Decoder, Encoder, LengthDelimitedCodec};
use uuid::Uuid;

use crate::error::TransportError;
use crate::message::RequestId;

const KIND_CONTROL: u8 = 0;
const KIND_OUTPUT: u8 = 1;
const MAX_FRAME_BYTES: usize = 32 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Frame {
    Control(Bytes),
    Output { session: Uuid, data: Bytes },
}

impl Frame {
    pub fn control<T: Serialize>(message: &T) -> Result<Self, TransportError> {
        Ok(Self::Control(serde_json::to_vec(message)?.into()))
    }

    pub fn parse_control<T: DeserializeOwned>(&self) -> Result<T, TransportError> {
        match self {
            Self::Control(body) => Ok(serde_json::from_slice(body)?),
            Self::Output { .. } => {
                Err(TransportError::MalformedFrame("expected control frame".into()))
            }
        }
    }

    pub fn request_id(&self) -> Option<RequestId> {
        #[derive(serde::Deserialize)]
        struct Header {
            id: RequestId,
        }
        self.parse_control::<Header>().ok().map(|header| header.id)
    }
}

pub struct FrameCodec {
    inner: LengthDelimitedCodec,
}

impl Default for FrameCodec {
    fn default() -> Self {
        let mut builder = LengthDelimitedCodec::builder();
        builder.max_frame_length(MAX_FRAME_BYTES);
        Self { inner: builder.new_codec() }
    }
}

impl Encoder<Frame> for FrameCodec {
    type Error = TransportError;

    fn encode(&mut self, item: Frame, dst: &mut BytesMut) -> Result<(), Self::Error> {
        let payload = match item {
            Frame::Control(body) => {
                let mut buf = BytesMut::with_capacity(1 + body.len());
                buf.put_u8(KIND_CONTROL);
                buf.put(body);
                buf.freeze()
            }
            Frame::Output { session, data } => {
                let mut buf = BytesMut::with_capacity(1 + 16 + data.len());
                buf.put_u8(KIND_OUTPUT);
                buf.put_slice(session.as_bytes());
                buf.put(data);
                buf.freeze()
            }
        };
        self.inner.encode(payload, dst).map_err(TransportError::Io)
    }
}

impl Decoder for FrameCodec {
    type Item = Frame;
    type Error = TransportError;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        let Some(mut payload) = self.inner.decode(src)? else {
            return Ok(None);
        };
        if payload.is_empty() {
            return Err(TransportError::MalformedFrame("empty frame".into()));
        }
        match payload.get_u8() {
            KIND_CONTROL => Ok(Some(Frame::Control(payload.freeze()))),
            KIND_OUTPUT => {
                if payload.len() < 16 {
                    return Err(TransportError::MalformedFrame("output missing session id".into()));
                }
                let mut raw = [0u8; 16];
                payload.copy_to_slice(&mut raw);
                Ok(Some(Frame::Output { session: Uuid::from_bytes(raw), data: payload.freeze() }))
            }
            other => Err(TransportError::MalformedFrame(format!("unknown kind: {other}"))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::message::{ClientMessage, Command, Hello, PROTOCOL_VERSION, RequestId};

    fn roundtrip(frame: Frame) -> Frame {
        let mut codec = FrameCodec::default();
        let mut buf = BytesMut::new();
        codec.encode(frame, &mut buf).expect("encode");
        codec.decode(&mut buf).expect("decode").expect("complete frame")
    }

    #[test]
    fn control_frame_roundtrips() {
        let hello = ClientMessage::Hello(Hello {
            protocol_version: PROTOCOL_VERSION,
            client_name: "apex-desktop".into(),
            identity: None,
        });
        let decoded: ClientMessage =
            roundtrip(Frame::control(&hello).expect("encode")).parse_control().expect("parse");
        assert_eq!(decoded, hello);
    }

    #[test]
    fn request_frame_roundtrips() {
        let request = ClientMessage::Request { id: RequestId(7), command: Command::ListAgents };
        let decoded: ClientMessage =
            roundtrip(Frame::control(&request).expect("encode")).parse_control().expect("parse");
        assert_eq!(decoded, request);
    }

    #[test]
    fn output_frame_preserves_binary_payload() {
        let session = Uuid::new_v4();
        let data = Bytes::from_static(&[0x1b, b'[', b'3', b'1', b'm', 0x00, 0xff]);
        let frame = Frame::Output { session, data: data.clone() };
        assert_eq!(roundtrip(frame), Frame::Output { session, data });
    }

    #[test]
    fn partial_frame_yields_none() {
        let mut codec = FrameCodec::default();
        let mut buf = BytesMut::new();
        codec.encode(Frame::Control(Bytes::from_static(b"{}")), &mut buf).expect("encode");
        let mut truncated = buf.split_to(buf.len() - 1);
        assert!(codec.decode(&mut truncated).expect("decode").is_none());
    }

    #[test]
    fn unknown_kind_is_rejected() {
        let mut codec = FrameCodec::default();
        let mut buf = BytesMut::new();
        let mut inner = LengthDelimitedCodec::new();
        inner.encode(Bytes::from_static(&[0xaa, 0x01]), &mut buf).expect("encode");
        assert!(codec.decode(&mut buf).is_err());
    }
}
