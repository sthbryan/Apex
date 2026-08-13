use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, mpsc};

use anyhow::{Context, Result};
use bytes::Bytes;
use portable_pty::{CommandBuilder, MasterPty, PtySize, native_pty_system};
use tokio::sync::{broadcast, watch};

use crate::ring::{DEFAULT_CAPACITY, RingBuffer};

const READ_CHUNK: usize = 8 * 1024;
const OUTPUT_CHANNEL_DEPTH: usize = 512;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PtySpec {
    pub command: PathBuf,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    pub env: BTreeMap<String, String>,
    pub rows: u16,
    pub cols: u16,
}

impl PtySpec {
    pub fn new(command: impl Into<PathBuf>, cwd: impl Into<PathBuf>) -> Self {
        Self {
            command: command.into(),
            args: Vec::new(),
            cwd: cwd.into(),
            env: BTreeMap::new(),
            rows: 24,
            cols: 80,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ExitStatus {
    pub code: u32,
}

pub struct PtyProcess {
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    input: mpsc::Sender<Bytes>,
    output: broadcast::Sender<Bytes>,
    buffer: Arc<Mutex<RingBuffer>>,
    exit: watch::Receiver<Option<ExitStatus>>,
    killer: Arc<Mutex<Box<dyn portable_pty::ChildKiller + Send + Sync>>>,
}

impl PtyProcess {
    pub fn spawn(spec: PtySpec) -> Result<Self> {
        let size = PtySize {
            rows: spec.rows.max(1),
            cols: spec.cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        };
        let pair = native_pty_system().openpty(size).context("abriendo el pty")?;

        let mut builder = CommandBuilder::new(&spec.command);
        builder.args(&spec.args);
        builder.cwd(&spec.cwd);
        builder.env("TERM", "xterm-256color");
        builder.env("COLORTERM", "truecolor");
        for (key, value) in &spec.env {
            builder.env(key, value);
        }

        let mut child = pair
            .slave
            .spawn_command(builder)
            .with_context(|| format!("lanzando {}", spec.command.display()))?;
        drop(pair.slave);

        let killer = child.clone_killer();
        let reader = pair.master.try_clone_reader().context("clonando el lector del pty")?;
        let writer = pair.master.take_writer().context("tomando el escritor del pty")?;

        let buffer = Arc::new(Mutex::new(RingBuffer::new(DEFAULT_CAPACITY)));
        let (output, _) = broadcast::channel(OUTPUT_CHANNEL_DEPTH);
        let (input, input_rx) = mpsc::channel::<Bytes>();
        let (exit_tx, exit) = watch::channel(None);

        spawn_reader(reader, buffer.clone(), output.clone());
        spawn_writer(writer, input_rx);
        std::thread::spawn(move || {
            let code = child.wait().map(|status| status.exit_code()).unwrap_or(u32::MAX);
            let _ = exit_tx.send(Some(ExitStatus { code }));
        });

        Ok(Self {
            master: Arc::new(Mutex::new(pair.master)),
            input,
            output,
            buffer,
            exit,
            killer: Arc::new(Mutex::new(killer)),
        })
    }

    pub fn write(&self, data: Bytes) -> Result<()> {
        self.input.send(data).context("el pty ya no acepta entrada")
    }

    pub fn resize(&self, rows: u16, cols: u16) -> Result<()> {
        let master = self.master.lock().expect("master envenenado");
        master
            .resize(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("redimensionando el pty")
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Bytes> {
        self.output.subscribe()
    }

    pub fn snapshot(&self) -> Bytes {
        self.buffer.lock().expect("buffer envenenado").snapshot()
    }

    pub fn exit_status(&self) -> Option<ExitStatus> {
        *self.exit.borrow()
    }

    pub async fn wait(&self) -> ExitStatus {
        let mut exit = self.exit.clone();
        loop {
            if let Some(status) = *exit.borrow_and_update() {
                return status;
            }
            if exit.changed().await.is_err() {
                return ExitStatus { code: u32::MAX };
            }
        }
    }

    pub fn kill(&self) -> Result<()> {
        let mut killer = self.killer.lock().expect("killer envenenado");
        killer.kill().context("matando el proceso del pty")
    }
}

fn spawn_reader(
    mut reader: Box<dyn Read + Send>,
    buffer: Arc<Mutex<RingBuffer>>,
    output: broadcast::Sender<Bytes>,
) {
    std::thread::spawn(move || {
        let mut chunk = vec![0u8; READ_CHUNK];
        loop {
            match reader.read(&mut chunk) {
                Ok(0) | Err(_) => return,
                Ok(read) => {
                    let slice = &chunk[..read];
                    buffer.lock().expect("buffer envenenado").push(slice);
                    let _ = output.send(Bytes::copy_from_slice(slice));
                }
            }
        }
    });
}

fn spawn_writer(mut writer: Box<dyn Write + Send>, input: mpsc::Receiver<Bytes>) {
    std::thread::spawn(move || {
        while let Ok(data) = input.recv() {
            if writer.write_all(&data).is_err() || writer.flush().is_err() {
                return;
            }
        }
    });
}

#[cfg(test)]
mod tests {
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
                "nunca aparecio {needle:?}; se vio {:?}",
                String::from_utf8_lossy(&process.snapshot())
            )
        })
    }

    #[tokio::test]
    async fn output_reaches_the_ring_buffer() {
        let process = PtyProcess::spawn(shell("echo hola-apex")).expect("spawn");
        wait_for(&process, "hola-apex").await;
        assert_eq!(process.wait().await.code, 0);
    }

    #[tokio::test]
    async fn subscribers_receive_the_output_stream() {
        let process = PtyProcess::spawn(shell("sleep 0.2; echo por-el-canal")).expect("spawn");
        let mut stream = process.subscribe();

        let seen = timeout(Duration::from_secs(10), async {
            let mut collected = Vec::new();
            while let Ok(chunk) = stream.recv().await {
                collected.extend_from_slice(&chunk);
                if String::from_utf8_lossy(&collected).contains("por-el-canal") {
                    return collected;
                }
            }
            collected
        })
        .await
        .expect("el canal nunca entrego la salida");

        assert!(String::from_utf8_lossy(&seen).contains("por-el-canal"));
    }

    #[tokio::test]
    async fn input_written_to_the_pty_is_processed() {
        let process = PtyProcess::spawn(shell("read linea; echo recibi:$linea")).expect("spawn");
        process.write(Bytes::from_static(b"ping\n")).expect("write");
        wait_for(&process, "recibi:ping").await;
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
        let status = timeout(Duration::from_secs(10), process.wait()).await.expect("no murio");
        assert_ne!(status.code, 0);
    }

    #[tokio::test]
    async fn spawning_a_missing_binary_fails() {
        let spec = PtySpec::new("/definitivamente/no/existe", "/tmp");
        assert!(PtyProcess::spawn(spec).is_err());
    }

    #[tokio::test]
    async fn massive_output_does_not_grow_the_buffer_past_capacity() {
        let process =
            PtyProcess::spawn(shell("for i in $(seq 1 20000); do echo linea-$i; done")).expect("spawn");
        process.wait().await;
        assert!(process.snapshot().len() <= DEFAULT_CAPACITY);
    }
}
