use super::*;

fn item(content: &str, status: Status) -> Todo {
    Todo { content: content.to_owned(), status }
}

#[test]
fn an_empty_list_says_it_is_empty() {
    assert_eq!(spell(&[]), "the list is empty now\n");
}

#[test]
fn a_list_counts_what_is_left() {
    let items = vec![
        item("uno", Status::Completed),
        item("dos", Status::InProgress),
        item("tres", Status::Pending),
    ];
    assert_eq!(spell(&items), "3 steps, 2 still to do\n");
}

#[test]
fn a_finished_list_has_nothing_left() {
    let items = vec![item("uno", Status::Completed)];
    assert_eq!(spell(&items), "1 steps, 0 still to do\n");
}

#[test]
fn each_state_has_a_mark_of_its_own() {
    assert_ne!(Status::Pending.mark(), Status::InProgress.mark());
    assert_ne!(Status::InProgress.mark(), Status::Completed.mark());
}

#[test]
fn the_states_are_named_the_way_the_protocol_names_them() {
    let raw = serde_json::to_string(&item("uno", Status::InProgress)).expect("json");
    assert!(raw.contains("\"in_progress\""));
    let back: Todo = serde_json::from_str(&raw).expect("back");
    assert_eq!(back.status, Status::InProgress);
}
