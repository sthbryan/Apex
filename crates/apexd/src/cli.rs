use std::path::Path;

use anyhow::Result;
use apex_mcp::Daemon;
use apex_proto::{Command, DaemonReport, IDLE_GRACE_NEVER, Reply};

use crate::link::Link;

const HELP: &str = "apex - talk to the daemon behind Apex Desktop

usage:
  apex status     report whether the daemon is up, and for how long
  apex help       print this
";

pub enum Verb {
    Help,
    Status,
    Unknown(String),
}

pub fn requested() -> Option<Verb> {
    let mut args = std::env::args();
    let called = args.next().unwrap_or_default();
    let named_apex = Path::new(&called).file_name().is_some_and(|name| name == "apex");
    let word = args.next();

    match word.as_deref() {
        Some("status") => Some(Verb::Status),
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
    }
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
