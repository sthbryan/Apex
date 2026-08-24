use super::*;
use crate::message::{
    ClientMessage, Command, Event, Hello, NotifyKind, PROTOCOL_VERSION, RequestId, ServerMessage,
};

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
        probe: false,
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

#[test]
fn a_notice_survives_the_server_envelope() {
    let event = Event::Notify {
        session: Some(uuid::Uuid::nil()),
        notice: NotifyKind::Terminal,
        title: Some("Apex".into()),
        body: "ready".into(),
    };
    let message = ServerMessage::Event(Box::new(event.clone()));
    let decoded: ServerMessage =
        roundtrip(Frame::control(&message).expect("encode")).parse_control().expect("parse");
    assert_eq!(decoded, ServerMessage::Event(Box::new(event)));
}
