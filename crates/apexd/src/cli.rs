use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use anyhow::{Context, Result};
use apex_mcp::Daemon;
use apex_proto::{Command, DaemonReport, IDLE_GRACE_NEVER, Reply, connect_unix};

use crate::link::Link;

const HELP: &str = "apex - talk to the daemon behind Apex Desktop

usage:
  apex status     report whether the daemon is up, and for how long
  apex start      start the daemon if it is not already up
  apex stop       stop the daemon and every session it holds
  apex notify <text> [--title <title>]
                  raise a desktop notice through Apex
  apex daemon     run the daemon here instead of in the background
  apex help       print this
";

const WAKE_TRIES: u32 = 40;
const WAKE_PAUSE: Duration = Duration::from_millis(100);

pub enum Verb {
    Help,
    Status,
    Start,
    Stop,
    Notify { title: Option<String>, body: String },
    Unknown(String),
}

pub fn requested() -> Option<Verb> {
    read(std::env::args())
}

pub fn read(args: impl Iterator<Item = String>) -> Option<Verb> {
    let mut args = args;
    let called = args.next().unwrap_or_default();
    let named_apex = Path::new(&called).file_name().is_some_and(|name| name == "apex");
    let word = args.next();
    let rest: Vec<String> = args.collect();

    match word.as_deref() {
        Some("notify") => Some(notice(&rest)),
        Some("daemon") => None,
        Some("status") => Some(Verb::Status),
        Some("start") => Some(Verb::Start),
        Some("stop") => Some(Verb::Stop),
        Some("help" | "--help" | "-h") => Some(Verb::Help),
        Some(word) if named_apex => Some(Verb::Unknown(word.to_string())),
        None if named_apex => Some(Verb::Help),
        _ => None,
    }
}

pub async fn run(socket: &Path, verb: Verb) -> Result<i32> {
    match verb {
        Verb::Help => {
            print!("{HELP}");
            Ok(0)
        }
        Verb::Unknown(word) => {
            eprintln!("apex: there is no {word} command");
            eprint!("{HELP}");
            Ok(2)
        }
        Verb::Status => status(socket).await,
        Verb::Start => start(socket).await,
        Verb::Stop => stop(socket).await,
        Verb::Notify { title, body } => notify(socket, title, body).await,
    }
}

fn notice(rest: &[String]) -> Verb {
    let mut title = None;
    let mut words = Vec::new();
    let mut taking = rest.iter();
    while let Some(word) = taking.next() {
        if word == "--title" {
            title = taking.next().cloned();
            continue;
        }
        words.push(word.clone());
    }
    Verb::Notify { title, body: words.join(" ") }
}

async fn notify(socket: &Path, title: Option<String>, body: String) -> Result<i32> {
    if body.trim().is_empty() {
        eprintln!("apex: notify needs something to say");
        return Ok(2);
    }

    let Ok(mut link) = Link::hail(socket, "apex-cli", true).await else {
        eprintln!("apexd is not running, so nobody heard that");
        return Ok(1);
    };

    let listening = match link.request(Command::DaemonStatus).await? {
        Reply::Daemon { report } => report.clients,
        _ => 0,
    };

    link.request(Command::Notify { title, body }).await?;

    if listening == 0 {
        eprintln!("apexd took it, but Apex is closed so it will not reach your desktop");
        return Ok(1);
    }
    Ok(0)
}

async fn start(socket: &Path) -> Result<i32> {
    if connect_unix(socket).await.is_ok() {
        println!("apexd is already running");
        return Ok(0);
    }

    let binary = std::env::current_exe().context("finding the apexd binary")?;
    std::process::Command::new(&binary)
        .arg("daemon")
        .process_group(0)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .with_context(|| format!("starting {}", binary.display()))?;

    for _ in 0..WAKE_TRIES {
        tokio::time::sleep(WAKE_PAUSE).await;
        if connect_unix(socket).await.is_ok() {
            println!("apexd is up");
            return Ok(0);
        }
    }
    eprintln!("apexd did not answer on {}", socket.display());
    Ok(1)
}

async fn stop(socket: &Path) -> Result<i32> {
    let Ok(mut link) = Link::hail(socket, "apex-cli", true).await else {
        println!("apexd is not running");
        return Ok(0);
    };

    link.request(Command::DaemonShutdown).await?;
    println!("apexd is stopping");
    Ok(0)
}

async fn status(socket: &Path) -> Result<i32> {
    let Ok(mut link) = Link::hail(socket, "apex-cli", true).await else {
        println!("apexd is not running");
        return Ok(1);
    };

    let Reply::Daemon { report } = link.request(Command::DaemonStatus).await? else {
        println!("apexd answered with something else");
        return Ok(1);
    };

    print!("{}", spell_report(&report));
    Ok(0)
}

pub fn spell_report(report: &DaemonReport) -> String {
    let running = if report.live == report.sessions {
        format!("{}", report.sessions)
    } else {
        format!("{}, {} running", report.sessions, report.live)
    };
    format!(
        "apexd      {}\nprotocol   {}\nuptime     {}\nclients    {}\nsessions   {}\nlifetime   {}\n",
        report.daemon_version,
        report.protocol_version,
        spell(report.uptime),
        report.clients,
        running,
        spell_lifetime(report),
    )
}

fn spell_lifetime(report: &DaemonReport) -> String {
    if report.idle_grace == IDLE_GRACE_NEVER {
        return "until you stop it".to_string();
    }
    if let Some(left) = report.remaining {
        return format!("{} left", spell(left));
    }
    if report.idle_grace == 0 {
        return "stops with the last client".to_string();
    }
    format!("{} after the last client leaves", spell(u64::from(report.idle_grace)))
}

pub fn spell(seconds: u64) -> String {
    if seconds >= 3600 {
        let minutes = (seconds % 3600) / 60;
        if minutes == 0 {
            return format!("{}h", seconds / 3600);
        }
        return format!("{}h {minutes}m", seconds / 3600);
    }
    if seconds >= 60 {
        let rest = seconds % 60;
        if rest == 0 {
            return format!("{}m", seconds / 60);
        }
        return format!("{}m {rest}s", seconds / 60);
    }
    format!("{seconds}s")
}
