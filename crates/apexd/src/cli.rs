use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use anyhow::{Context, Result};
use apex_core::ApexPaths;
use apex_mcp::Daemon;
use apex_proto::{Command, DaemonReport, IDLE_GRACE_NEVER, PROTOCOL_VERSION, Reply, connect_unix};

use crate::link::{Greeted, Link};

const HELP: &str = "apex - talk to the daemon behind Apex Desktop

usage:
  apex status     report whether the daemon is up, and for how long
  apex start      start the daemon if it is not already up
  apex stop       stop the daemon and every session it holds
  apex notify <text> [--title <title>]
                  raise a desktop notice through Apex
  apex auth       list the providers and which of them hold a key
  apex auth add <provider>
                  type a key once and keep it in the OS keychain
  apex auth rm <provider>
                  forget the key kept for a provider
  apex auth models <provider>
                  list the models a provider says it has
  apex uninstall  stop the daemon and remove Apex from this machine
  apex daemon     run the daemon here instead of in the background
  apex help       print this
";

const WAKE_TRIES: u32 = 40;
const WAKE_PAUSE: Duration = Duration::from_millis(100);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ask {
    Yes,
    No,
    Prompt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Auth {
    List,
    Add(String),
    Remove(String),
    Models(String),
    Wrong(String),
}

pub enum Verb {
    Help,
    Status,
    Start,
    Stop,
    Notify { title: Option<String>, body: String },
    Auth(Auth),
    Uninstall { settings: Ask, confirmed: bool },
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
        Some("auth") => Some(Verb::Auth(credentials(&rest))),
        Some("uninstall") => Some(removal(&rest)),
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
        Verb::Auth(auth) => crate::auth::run(auth).await,
        Verb::Uninstall { settings, confirmed } => uninstall(socket, settings, confirmed).await,
    }
}

fn credentials(rest: &[String]) -> Auth {
    let name = rest.get(1).map(|name| name.trim()).filter(|name| !name.is_empty());
    match (rest.first().map(String::as_str), name) {
        (None | Some("list"), _) => Auth::List,
        (Some("add"), Some(name)) => Auth::Add(name.to_owned()),
        (Some("rm" | "remove"), Some(name)) => Auth::Remove(name.to_owned()),
        (Some("models"), Some(name)) => Auth::Models(name.to_owned()),
        (Some(word @ ("add" | "rm" | "remove" | "models")), None) => {
            Auth::Wrong(format!("auth {word} needs a provider"))
        }
        (Some(word), _) => Auth::Wrong(format!("there is no auth {word}")),
    }
}

fn removal(rest: &[String]) -> Verb {
    let flag = |name: &str| rest.iter().any(|word| word == name);
    let settings = match (flag("--all"), flag("--keep-settings")) {
        (true, false) => Ask::Yes,
        (false, true) => Ask::No,
        _ => Ask::Prompt,
    };
    Verb::Uninstall { settings, confirmed: flag("--yes") }
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
    if shut_down(socket).await? {
        println!("apexd is stopping");
    } else {
        println!("apexd is not running");
    }
    Ok(0)
}

async fn shut_down(socket: &Path) -> Result<bool> {
    let greeted = match Link::knock(socket, "apex-cli", true, PROTOCOL_VERSION).await {
        Ok(greeted) => greeted,
        Err(_) => return Ok(false),
    };

    let mut link = match greeted {
        Greeted::Linked(link) => *link,
        Greeted::Stranger(speaks) => match Link::knock(socket, "apex-cli", true, speaks).await {
            Ok(Greeted::Linked(link)) => *link,
            _ => return Ok(false),
        },
    };

    link.request(Command::DaemonShutdown).await?;
    Ok(true)
}

async fn status(socket: &Path) -> Result<i32> {
    let mut link = match Link::knock(socket, "apex-cli", true, PROTOCOL_VERSION).await {
        Ok(Greeted::Linked(link)) => *link,
        Ok(Greeted::Stranger(speaks)) => {
            println!(
                "apexd is running, but it speaks protocol v{speaks} and this one speaks v{PROTOCOL_VERSION}"
            );
            println!("run apex stop to retire it, then open Apex again");
            return Ok(1);
        }
        Err(_) => {
            println!("apexd is not running");
            return Ok(1);
        }
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

const IDENTIFIER: &str = "com.justcallmebryan.apex";

pub fn app_traces(bundle: Option<&Path>, link: Option<&Path>) -> Vec<PathBuf> {
    bundle.into_iter().chain(link).map(Path::to_path_buf).collect()
}

pub fn data_traces(home: &Path, config: &Path) -> Vec<PathBuf> {
    let mut found = vec![config.to_path_buf()];
    let library = home.join("Library");
    for leaf in [
        library.join("Application Support").join(IDENTIFIER),
        library.join("Caches").join(IDENTIFIER),
        library.join("WebKit").join(IDENTIFIER),
        library.join("HTTPStorages").join(IDENTIFIER),
        library.join("Preferences").join(format!("{IDENTIFIER}.plist")),
        library.join("Saved Application State").join(format!("{IDENTIFIER}.savedState")),
        home.join(".config").join(IDENTIFIER),
        home.join(".cache").join(IDENTIFIER),
        home.join(".local").join("share").join(IDENTIFIER),
    ] {
        found.push(leaf);
    }
    found
}

pub fn bundle_of(binary: &Path, appimage: Option<PathBuf>) -> Option<PathBuf> {
    if let Some(image) = appimage {
        return Some(image);
    }
    binary
        .ancestors()
        .find(|step| step.extension().is_some_and(|kind| kind == "app"))
        .map(Path::to_path_buf)
}

fn our_link(home: &Path, binary: &Path) -> Option<PathBuf> {
    let link = home.join(".local").join("bin").join("apex");
    let aimed = std::fs::read_link(&link).ok()?;
    (aimed == binary).then_some(link)
}

async fn uninstall(socket: &Path, settings: Ask, confirmed: bool) -> Result<i32> {
    let paths = ApexPaths::discover().context("finding the apex folders")?;
    let binary = std::env::current_exe()
        .ok()
        .and_then(|exe| std::fs::canonicalize(exe).ok())
        .unwrap_or_default();

    let bundle = bundle_of(&binary, std::env::var_os("APPIMAGE").map(PathBuf::from));
    let link = our_link(&paths.home, &binary);
    let app = app_traces(bundle.as_deref(), link.as_deref());

    let wipe = match settings {
        Ask::Yes => true,
        Ask::No => false,
        Ask::Prompt => confirm("Also remove your settings, projects and history?")?,
    };
    let data = if wipe { data_traces(&paths.home, &paths.config_dir) } else { Vec::new() };

    let doomed: Vec<PathBuf> =
        app.into_iter().chain(data).filter(|path| path.symlink_metadata().is_ok()).collect();

    if doomed.is_empty() {
        println!("there is nothing left to remove");
    } else {
        println!("this will delete:");
        for path in &doomed {
            println!("  {}", path.display());
        }
    }
    println!("and stop the daemon");

    if !confirmed && !agrees("type uninstall to go ahead: ", "uninstall")? {
        println!("nothing was touched");
        return Ok(1);
    }

    let _ = shut_down(socket).await;

    let mut failed = false;
    for path in &doomed {
        if let Err(error) = erase(path) {
            eprintln!("could not remove {}: {error}", path.display());
            failed = true;
        }
    }

    if bundle.is_none() {
        println!("the app itself was installed by your package manager, remove it from there");
    }
    if failed { Ok(1) } else { Ok(0) }
}

fn erase(path: &Path) -> std::io::Result<()> {
    let about = path.symlink_metadata()?;
    if about.is_dir() { std::fs::remove_dir_all(path) } else { std::fs::remove_file(path) }
}

fn confirm(question: &str) -> Result<bool> {
    print!("{question} [y/N] ");
    std::io::Write::flush(&mut std::io::stdout())?;
    let mut said = String::new();
    std::io::BufRead::read_line(&mut std::io::stdin().lock(), &mut said)?;
    Ok(matches!(said.trim(), "y" | "Y" | "yes"))
}

fn agrees(question: &str, word: &str) -> Result<bool> {
    print!("{question}");
    std::io::Write::flush(&mut std::io::stdout())?;
    let mut said = String::new();
    std::io::BufRead::read_line(&mut std::io::stdin().lock(), &mut said)?;
    Ok(said.trim() == word)
}
