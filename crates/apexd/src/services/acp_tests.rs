use apex_acp::{PlanEntry, ToolLocation};
use apex_proto::{AcpBody, AcpOption, AcpToolStatus};

use crate::services::acp::Transcript;

fn chunk(text: &str) -> apex_acp::SessionUpdate {
    apex_acp::SessionUpdate::AgentMessageChunk { content: apex_acp::ContentBlock::text(text) }
}

#[test]
fn chunks_of_one_answer_grow_a_single_entry() {
    let mut transcript = Transcript::default();
    transcript.absorb(chunk("Hola"));
    let entry = transcript.absorb(chunk(", qué tal")).expect("an entry");

    assert_eq!(entry.index, 0);
    assert_eq!(transcript.entries().len(), 1);
    assert_eq!(entry.body, AcpBody::Agent { text: "Hola, qué tal".to_owned() });
}

#[test]
fn a_thought_and_an_answer_never_share_an_entry() {
    let mut transcript = Transcript::default();
    transcript.absorb(chunk("one"));
    transcript
        .absorb(apex_acp::SessionUpdate::AgentThoughtChunk {
            content: apex_acp::ContentBlock::text("hmm"),
        })
        .expect("a thought");
    transcript.absorb(chunk("two"));

    let entries = transcript.entries();
    assert_eq!(entries.len(), 3);
    assert_eq!(entries[0].body, AcpBody::Agent { text: "one".to_owned() });
    assert_eq!(entries[1].body, AcpBody::Thought { text: "hmm".to_owned() });
    assert_eq!(entries[2].body, AcpBody::Agent { text: "two".to_owned() });
}

#[test]
fn an_update_lands_on_the_tool_call_it_belongs_to() {
    use apex_acp::{ToolCall, ToolContent, ToolStatus};

    let mut transcript = Transcript::default();
    transcript.absorb(apex_acp::SessionUpdate::ToolCall {
        call: ToolCall {
            tool_call_id: "call-1".into(),
            title: Some("Edit main.rs".into()),
            kind: Some("edit".into()),
            status: Some(ToolStatus::Pending),
            locations: vec![ToolLocation { path: "/tmp/main.rs".into(), line: None }],
            ..ToolCall::default()
        },
    });
    let entry = transcript
        .absorb(apex_acp::SessionUpdate::ToolCallUpdate {
            call: ToolCall {
                tool_call_id: "call-1".into(),
                status: Some(ToolStatus::Completed),
                content: vec![ToolContent::Diff {
                    path: "/tmp/main.rs".into(),
                    old_text: Some("one".into()),
                    new_text: "two".into(),
                }],
                ..ToolCall::default()
            },
        })
        .expect("an entry");

    assert_eq!(transcript.entries().len(), 1);
    let AcpBody::Tool { call } = entry.body else {
        panic!("expected a tool call");
    };
    assert_eq!(call.status, AcpToolStatus::Completed);
    assert_eq!(call.title, "Edit main.rs");
    assert_eq!(call.kind, "edit");
    assert_eq!(call.locations, vec!["/tmp/main.rs".to_owned()]);
    assert_eq!(call.diffs.len(), 1);
    assert_eq!(call.diffs[0].new_text, "two");
}

#[test]
fn two_tool_calls_keep_their_own_entries() {
    use apex_acp::ToolCall;

    let mut transcript = Transcript::default();
    for id in ["call-1", "call-2"] {
        transcript.absorb(apex_acp::SessionUpdate::ToolCall {
            call: ToolCall { tool_call_id: id.into(), ..ToolCall::default() },
        });
    }
    assert_eq!(transcript.entries().len(), 2);
}

#[test]
fn a_decision_marks_the_question_it_answers() {
    let mut transcript = Transcript::default();
    let (request, entry) = transcript.asked(
        "Write main.rs",
        vec![AcpOption {
            id: "allow_once".into(),
            about: None,
            name: "Allow once".into(),
            kind: "allow_once".into(),
        }],
        None,
    );
    assert_eq!(entry.index, 0);

    let answered = transcript.decided(request, Some("allow_once".into())).expect("an entry");
    let AcpBody::Permission { ask } = answered.body else {
        panic!("expected a permission");
    };
    assert_eq!(ask.decided.as_deref(), Some("allow_once"));
}

#[test]
fn a_cancelled_question_is_still_marked_as_decided() {
    let mut transcript = Transcript::default();
    let (request, _) = transcript.asked("Write main.rs", Vec::new(), None);
    let answered = transcript.decided(request, None).expect("an entry");
    let AcpBody::Permission { ask } = answered.body else {
        panic!("expected a permission");
    };
    assert_eq!(ask.decided.as_deref(), Some("cancelled"));
}

#[test]
fn a_plan_closes_the_open_answer() {
    let mut transcript = Transcript::default();
    transcript.absorb(chunk("one"));
    transcript.absorb(apex_acp::SessionUpdate::Plan {
        entries: vec![PlanEntry {
            content: "Read the file".into(),
            status: Some("in_progress".into()),
            priority: None,
        }],
    });
    transcript.absorb(chunk("two"));

    let entries = transcript.entries();
    assert_eq!(entries.len(), 3);
    assert_eq!(entries[2].body, AcpBody::Agent { text: "two".to_owned() });
}

#[test]
fn a_mode_change_is_not_worth_an_entry() {
    let mut transcript = Transcript::default();
    let entry = transcript
        .absorb(apex_acp::SessionUpdate::CurrentModeUpdate { current_mode_id: "ask".into() });
    assert!(entry.is_none());
    assert!(transcript.entries().is_empty());
}
