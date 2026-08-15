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

const BASELINE_ENV: &[&str] = &["HOME", "PATH", "USER", "LOGNAME", "SHELL", "LANG", "TMPDIR"];

impl PtySpec {
    pub fn new(command: impl Into<PathBuf>, cwd: impl Into<PathBuf>) -> Self {
        Self {
            command: command.into(),
            args: Vec::new(),
            cwd: cwd.into(),
            env: baseline_env(),
            rows: 24,
            cols: 80,
        }
    }
}

fn baseline_env() -> BTreeMap<String, String> {
    BASELINE_ENV
        .iter()
        .filter_map(|key| std::env::var(key).ok().map(|value| ((*key).to_string(), value)))
        .collect()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ExitStatus {
    pub code: u32,
}

pub struct PtyProcess {
    pid: Option<u32>,
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
        let pair = native_pty_system().openpty(size).context("opening pty")?;

        let mut builder = CommandBuilder::new(&spec.command);
        builder.args(&spec.args);
        builder.cwd(&spec.cwd);
        builder.env_clear();
        builder.env("TERM", "xterm-256color");
        builder.env("COLORTERM", "truecolor");
        for (key, value) in &spec.env {
            builder.env(key, value);
        }

        let mut child = pair
            .slave
            .spawn_command(builder)
            .with_context(|| format!("spawning {}", spec.command.display()))?;
        drop(pair.slave);

        let pid = child.process_id();
        let killer = child.clone_killer();
        let reader = pair.master.try_clone_reader().context("cloning pty reader")?;
        let writer = pair.master.take_writer().context("taking pty writer")?;

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
            pid,
            master: Arc::new(Mutex::new(pair.master)),
            input,
            output,
            buffer,
            exit,
            killer: Arc::new(Mutex::new(killer)),
        })
    }

    pub fn pid(&self) -> Option<u32> {
        self.pid
    }

    pub fn write(&self, data: Bytes) -> Result<()> {
        self.input.send(data).context("pty no longer accepts input")
    }

    pub fn resize(&self, rows: u16, cols: u16) -> Result<()> {
        let master = self.master.lock().expect("master poisoned");
        master
            .resize(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("resizing pty")
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Bytes> {
        self.output.subscribe()
    }

    pub fn snapshot(&self) -> Bytes {
        self.buffer.lock().expect("buffer poisoned").snapshot()
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
        let mut killer = self.killer.lock().expect("killer poisoned");
        killer.kill().context("killing pty process")
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
                    buffer.lock().expect("buffer poisoned").push(slice);
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
#[path = "process_tests.rs"]
mod tests;
