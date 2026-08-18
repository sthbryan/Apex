use super::*;
use std::time::Duration;
use tokio::time::{sleep, timeout};

fn shell(script: &str) -> PtySpec {
    let mut spec = PtySpec::new("/bin/sh", "/tmp");
    spec.args = vec!["-c".into(), script.into()];
    spec
}

async fn wait_for(process: &PtyProcess, needle: &str) -> String {
    let found = timeout(Duration::from_secs(10), async {
        loop {
            let snapshot = String::from_utf8_lossy(&process.snapshot()).to_string();
            if snapshot.contains(needle) {
                return snapshot;
            }
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await;
    found.unwrap_or_else(|_| {
        panic!(
            "never saw {needle:?}; got {:?}",
            String::from_utf8_lossy(&process.snapshot())
        )
    })
}

#[tokio::test]
async fn output_reaches_the_ring_buffer() {
    let process = PtyProcess::spawn(shell("echo hello-apex")).expect("spawn");
    wait_for(&process, "hello-apex").await;
    assert_eq!(process.wait().await.code, 0);
}

#[tokio::test]
async fn subscribers_receive_the_output_stream() {
    let process = PtyProcess::spawn(shell("sleep 0.2; echo over-the-channel")).expect("spawn");
    let mut stream = process.subscribe();

    let seen = timeout(Duration::from_secs(10), async {
        let mut collected = Vec::new();
        while let Ok(chunk) = stream.recv().await {
            collected.extend_from_slice(&chunk);
            if String::from_utf8_lossy(&collected).contains("over-the-channel") {
                return collected;
            }
        }
        collected
    })
    .await
    .expect("channel never delivered output");

    assert!(String::from_utf8_lossy(&seen).contains("over-the-channel"));
}

#[tokio::test]
async fn input_written_to_the_pty_is_processed() {
    let process = PtyProcess::spawn(shell("read line; echo got:$line")).expect("spawn");
    process.write(Bytes::from_static(b"ping\n")).expect("write");
    wait_for(&process, "got:ping").await;
}

#[tokio::test]
async fn the_initial_size_reaches_the_child() {
    let mut spec = shell("stty size");
    spec.rows = 30;
    spec.cols = 100;
    let process = PtyProcess::spawn(spec).expect("spawn");
    wait_for(&process, "30 100").await;
}

#[tokio::test]
async fn resizing_after_spawn_reaches_the_child() {
    let process = PtyProcess::spawn(shell("sleep 0.4; stty size")).expect("spawn");
    process.resize(40, 120).expect("resize");
    wait_for(&process, "40 120").await;
}

#[tokio::test]
async fn a_nonzero_exit_is_reported() {
    let process = PtyProcess::spawn(shell("exit 3")).expect("spawn");
    assert_eq!(process.wait().await.code, 3);
    assert_eq!(process.exit_status(), Some(ExitStatus { code: 3 }));
}

#[tokio::test]
async fn killing_ends_a_long_running_process() {
    let process = PtyProcess::spawn(shell("sleep 30")).expect("spawn");
    process.kill().expect("kill");
    let status = timeout(Duration::from_secs(10), process.wait()).await.expect("did not die");
    assert_ne!(status.code, 0);
}

#[tokio::test]
async fn the_parent_environment_does_not_leak_into_the_child() {
    const SET_BY_THE_SHELL: &[&str] = &["PWD", "SHLVL", "_", "TERM", "COLORTERM", "OLDPWD"];

    let Some(candidate) = std::env::vars().map(|(key, _)| key).find(|key| {
        !BASELINE_ENV.contains(&key.as_str()) && !SET_BY_THE_SHELL.contains(&key.as_str())
    }) else {
        return;
    };

    let process =
        PtyProcess::spawn(shell(&format!("echo leak:[${{{candidate}}}]"))).expect("spawn");
    let text = wait_for(&process, "leak:").await;
    assert!(text.contains("leak:[]"), "leaked {candidate}: {text}");
}

#[tokio::test]
async fn an_empty_spec_value_unsets_the_variable() {
    let mut spec = shell("echo colour:[${COLORTERM}]");
    spec.env.insert("COLORTERM".into(), String::new());
    let process = PtyProcess::spawn(spec).expect("spawn");
    let text = wait_for(&process, "colour:").await;
    assert!(text.contains("colour:[]"), "{text}");
}

#[tokio::test]
async fn the_spec_environment_reaches_the_child() {
    let mut spec = shell("echo value:[${APEX_INJECTED}]");
    spec.env.insert("APEX_INJECTED".into(), "present".into());
    let process = PtyProcess::spawn(spec).expect("spawn");
    let text = wait_for(&process, "value:").await;
    assert!(text.contains("value:[present]"), "variable did not arrive: {text}");
}

#[tokio::test]
async fn a_spawned_process_reports_its_pid() {
    let process = PtyProcess::spawn(shell("echo $$; sleep 5")).expect("spawn");
    let pid = process.pid().expect("missing pid");
    let text = wait_for(&process, &pid.to_string()).await;
    assert!(text.contains(&pid.to_string()), "pid mismatch: {text}");
}

#[tokio::test]
async fn spawning_a_missing_binary_fails() {
    let spec = PtySpec::new("/definitely/does/not/exist", "/tmp");
    assert!(PtyProcess::spawn(spec).is_err());
}

#[tokio::test]
async fn massive_output_does_not_grow_the_buffer_past_capacity() {
    let process =
        PtyProcess::spawn(shell("for i in $(seq 1 20000); do echo line-$i; done")).expect("spawn");
    process.wait().await;
    assert!(process.snapshot().len() <= DEFAULT_CAPACITY);
}
