use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{Context, Result, bail};

pub const WORKTREE_DIR: &str = ".apex/worktrees";
pub const BRANCH_PREFIX: &str = "apex";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeKind {
    Added,
    Modified,
    Deleted,
    Renamed,
    Untracked,
    Conflicted,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Change {
    pub path: String,
    pub kind: ChangeKind,
    pub staged: bool,
    pub added: u32,
    pub removed: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Worktree {
    pub path: PathBuf,
    pub branch: String,
}

pub fn is_repo(dir: &Path) -> bool {
    run(dir, &["rev-parse", "--git-dir"]).is_ok()
}

pub fn current_branch(dir: &Path) -> Result<String> {
    let head = run(dir, &["rev-parse", "--abbrev-ref", "HEAD"])?;
    Ok(head.trim().to_owned())
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Upstream {
    pub name: String,
    pub ahead: u32,
    pub behind: u32,
}

pub fn upstream(dir: &Path) -> Option<Upstream> {
    let name = run(dir, &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])
        .ok()?
        .trim()
        .to_owned();
    let counts = run(dir, &["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]).ok()?;
    let mut numbers = counts.split_whitespace();
    Some(Upstream {
        name,
        behind: numbers.next().and_then(|value| value.parse().ok()).unwrap_or(0),
        ahead: numbers.next().and_then(|value| value.parse().ok()).unwrap_or(0),
    })
}

pub fn status(dir: &Path) -> Result<Vec<Change>> {
    let raw = run(dir, &["status", "--porcelain=v1", "-z", "--untracked-files=all"])?;
    let mut fields = raw.split('\0').filter(|field| !field.is_empty());
    let mut changes = Vec::new();

    while let Some(record) = fields.next() {
        let Some((codes, path)) = record.split_at_checked(3) else {
            continue;
        };
        let mut marks = codes.chars();
        let index = marks.next().unwrap_or(' ');
        let worktree = marks.next().unwrap_or(' ');

        if index == 'R' || index == 'C' {
            fields.next();
        }

        changes.push(Change {
            path: path.to_owned(),
            kind: classify(index, worktree),
            staged: index != ' ' && index != '?',
            added: 0,
            removed: 0,
        });
    }

    let counts = line_counts(dir)?;
    for change in &mut changes {
        if let Some((added, removed)) = counts.get(&change.path) {
            change.added = *added;
            change.removed = *removed;
        } else if change.kind == ChangeKind::Untracked {
            change.added = count_lines(&dir.join(&change.path));
        }
    }

    changes.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(changes)
}

fn line_counts(dir: &Path) -> Result<std::collections::HashMap<String, (u32, u32)>> {
    let raw = run(dir, &["diff", "--numstat", "-z", "HEAD"]).unwrap_or_default();
    let mut fields = raw.split('\0').filter(|field| !field.is_empty());
    let mut counts = std::collections::HashMap::new();

    while let Some(record) = fields.next() {
        let mut parts = record.splitn(3, '\t');
        let added = parts.next().unwrap_or_default();
        let removed = parts.next().unwrap_or_default();
        let Some(path) = parts.next() else {
            continue;
        };
        let path = if path.is_empty() {
            fields.next();
            match fields.next() {
                Some(renamed) => renamed.to_owned(),
                None => continue,
            }
        } else {
            path.to_owned()
        };
        counts.insert(path, (added.parse().unwrap_or(0), removed.parse().unwrap_or(0)));
    }
    Ok(counts)
}

fn count_lines(path: &Path) -> u32 {
    std::fs::read_to_string(path).map(|text| text.lines().count() as u32).unwrap_or_default()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scope {
    Unstaged,
    Staged,
    Both,
}

pub fn change_count(dir: &Path) -> Result<usize> {
    let raw = run(dir, &["status", "--porcelain=v1", "-z", "--untracked-files=all"])?;
    let mut fields = raw.split('\0').filter(|field| !field.is_empty());
    let mut total = 0;

    while let Some(record) = fields.next() {
        if record.len() < 3 {
            continue;
        }
        if record.starts_with('R') || record.starts_with('C') {
            fields.next();
        }
        total += 1;
    }
    Ok(total)
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Tally {
    pub files: u32,
    pub added: u32,
    pub removed: u32,
}

pub fn tally(dir: &Path) -> Result<Tally> {
    let changes = status(dir)?;
    Ok(Tally {
        files: changes.len() as u32,
        added: changes.iter().map(|change| change.added).sum(),
        removed: changes.iter().map(|change| change.removed).sum(),
    })
}

pub fn diff_scoped(dir: &Path, path: &str, scope: Scope) -> Result<String> {
    let tracked = run(dir, &["ls-files", "--error-unmatch", "--", path]).is_ok();
    if !tracked {
        return diff(dir, path);
    }
    match scope {
        Scope::Unstaged => run(dir, &["diff", "--", path]),
        Scope::Staged => run(dir, &["diff", "--cached", "--", path]),
        Scope::Both => run(dir, &["diff", "HEAD", "--", path]),
    }
}

pub fn stage(dir: &Path, paths: &[String]) -> Result<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args = vec!["add", "--"];
    args.extend(paths.iter().map(String::as_str));
    run(dir, &args).map(|_| ())
}

pub fn unstage(dir: &Path, paths: &[String]) -> Result<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args = vec!["restore", "--staged", "--"];
    args.extend(paths.iter().map(String::as_str));
    run(dir, &args).map(|_| ())
}

pub fn split_hunks(patch: &str) -> Vec<String> {
    let mut header = String::new();
    let mut hunks: Vec<String> = Vec::new();

    for line in patch.lines() {
        if line.starts_with("@@") {
            hunks.push(String::new());
        }
        match hunks.last_mut() {
            Some(current) => {
                current.push_str(line);
                current.push('\n');
            }
            None => {
                header.push_str(line);
                header.push('\n');
            }
        }
    }

    hunks.into_iter().map(|hunk| format!("{header}{hunk}")).collect()
}

pub fn apply_to_index(dir: &Path, patch: &str, reverse: bool) -> Result<()> {
    let mut args = vec!["apply", "--cached"];
    if reverse {
        args.push("--reverse");
    }
    args.push("-");
    run_with_input(dir, &args, patch).map(|_| ())
}

pub fn commit(dir: &Path, message: &str) -> Result<Commit> {
    if message.trim().is_empty() {
        bail!("the commit message is empty")
    }
    run(dir, &["commit", "-m", message])?;
    log(dir, 1)?.into_iter().next().context("the commit did not land")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Sync {
    Fetch,
    Pull,
    Push,
}

pub fn sync(dir: &Path, op: Sync) -> Result<()> {
    let tracking = upstream(dir);
    match op {
        Sync::Fetch => run(dir, &["fetch", "--prune"]).map(|_| ()),
        Sync::Pull => {
            if tracking.is_none() {
                bail!("{} has no upstream to pull from", current_branch(dir)?)
            }
            run(dir, &["pull", "--rebase", "--autostash"]).map(|_| ())
        }
        Sync::Push => match tracking {
            Some(_) => run(dir, &["push"]).map(|_| ()),
            None => run(dir, &["push", "--set-upstream", "origin", "HEAD"]).map(|_| ()),
        },
    }
}

pub fn staged_paths(dir: &Path) -> Result<Vec<String>> {
    Ok(status(dir)?.into_iter().filter(|change| change.staged).map(|change| change.path).collect())
}

pub fn diff(dir: &Path, path: &str) -> Result<String> {
    let tracked = run(dir, &["ls-files", "--error-unmatch", "--", path]).is_ok();
    if tracked {
        return run(dir, &["diff", "HEAD", "--", path]);
    }
    run(dir, &["diff", "--no-index", "--", "/dev/null", path]).or_else(|_| {
        let contents = std::fs::read_to_string(dir.join(path)).unwrap_or_default();
        Ok(contents.lines().map(|line| format!("+{line}\n")).collect())
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Commit {
    pub id: String,
    pub short: String,
    pub author: String,
    pub when: i64,
    pub summary: String,
    pub refs: String,
}

pub fn blob(dir: &Path, rev: &str, path: &str) -> Option<Vec<u8>> {
    run_bytes(dir, &["show", &format!("{rev}:{path}")]).ok()
}

pub fn log(dir: &Path, limit: usize) -> Result<Vec<Commit>> {
    let format = "--pretty=format:%H%x1f%h%x1f%an%x1f%at%x1f%s%x1f%D%x1e";
    let raw = run(dir, &["log", &format!("-n{limit}"), format])?;

    let mut commits = Vec::new();
    for record in raw.split('\u{1e}') {
        let record = record.trim_start_matches('\n');
        if record.is_empty() {
            continue;
        }
        let fields: Vec<&str> = record.split('\u{1f}').collect();
        let [id, short, author, when, summary, refs] = fields.as_slice() else {
            continue;
        };
        commits.push(Commit {
            id: (*id).to_owned(),
            short: (*short).to_owned(),
            author: (*author).to_owned(),
            when: when.parse().unwrap_or_default(),
            summary: (*summary).to_owned(),
            refs: (*refs).to_owned(),
        });
    }
    Ok(commits)
}

pub fn show(dir: &Path, commit: &str, path: Option<&str>) -> Result<String> {
    let mut args = vec!["show", "--patch", "--stat", commit];
    if let Some(path) = path {
        args.push("--");
        args.push(path);
    }
    run(dir, &args)
}

pub fn add_worktree(root: &Path, slug: &str) -> Result<Worktree> {
    let branch = format!("{BRANCH_PREFIX}/{slug}");
    let path = root.join(WORKTREE_DIR).join(slug);
    if path.exists() {
        bail!("{} already exists", path.display());
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("creating {}", parent.display()))?;
    }
    exclude_worktrees(root)?;

    run(root, &["worktree", "add", "-b", &branch, &path.display().to_string()])
        .with_context(|| format!("creating the worktree for {branch}"))?;
    Ok(Worktree { path, branch })
}

pub fn remove_worktree(root: &Path, path: &Path, delete_branch: Option<&str>) -> Result<()> {
    run(root, &["worktree", "remove", "--force", &path.display().to_string()])
        .with_context(|| format!("removing {}", path.display()))?;
    if let Some(branch) = delete_branch {
        run(root, &["branch", "-D", branch]).with_context(|| format!("deleting {branch}"))?;
    }
    Ok(())
}

pub fn list_worktrees(root: &Path) -> Result<Vec<Worktree>> {
    let raw = run(root, &["worktree", "list", "--porcelain"])?;
    let mut worktrees = Vec::new();
    let mut path: Option<PathBuf> = None;

    for line in raw.lines() {
        if let Some(rest) = line.strip_prefix("worktree ") {
            path = Some(PathBuf::from(rest));
        } else if let Some(rest) = line.strip_prefix("branch ")
            && let Some(current) = path.take()
        {
            let branch = rest.trim_start_matches("refs/heads/").to_owned();
            worktrees.push(Worktree { path: current, branch });
        }
    }
    Ok(worktrees)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MergeOutcome {
    Merged,
    Conflicted { files: Vec<String> },
}

pub fn merge(root: &Path, branch: &str) -> Result<MergeOutcome> {
    match run(root, &["merge", "--no-ff", branch]) {
        Ok(_) => Ok(MergeOutcome::Merged),
        Err(error) => {
            let unmerged = run(root, &["diff", "--name-only", "--diff-filter=U"])?;
            let files: Vec<String> = unmerged
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(str::to_owned)
                .collect();
            if files.is_empty() {
                return Err(error);
            }
            Ok(MergeOutcome::Conflicted { files })
        }
    }
}

pub fn abort_merge(root: &Path) -> Result<()> {
    run(root, &["merge", "--abort"]).map(|_| ())
}

pub fn slugify(title: &str) -> String {
    let mut slug = String::new();
    for character in title.chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    slug.trim_matches('-').to_owned()
}

pub fn exclude(root: &Path, entry: &str) -> Result<()> {
    write_exclude(root, &format!("/{entry}"))
}

fn exclude_worktrees(root: &Path) -> Result<()> {
    write_exclude(root, &format!("/{WORKTREE_DIR}/"))
}

fn write_exclude(root: &Path, entry: &str) -> Result<()> {
    let git_dir = run(root, &["rev-parse", "--git-common-dir"])?;
    let info = Path::new(git_dir.trim()).to_path_buf();
    let info = if info.is_absolute() { info } else { root.join(info) };
    let exclude = info.join("info").join("exclude");

    let current = std::fs::read_to_string(&exclude).unwrap_or_default();
    if current.lines().any(|line| line.trim() == entry) {
        return Ok(());
    }
    if let Some(parent) = exclude.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let separator = if current.is_empty() || current.ends_with('\n') { "" } else { "\n" };
    std::fs::write(&exclude, format!("{current}{separator}{entry}\n"))
        .with_context(|| format!("writing {}", exclude.display()))?;
    Ok(())
}

fn classify(index: char, worktree: char) -> ChangeKind {
    if index == 'U' || worktree == 'U' || (index == 'A' && worktree == 'A') {
        return ChangeKind::Conflicted;
    }
    match if worktree == ' ' { index } else { worktree } {
        '?' => ChangeKind::Untracked,
        'A' => ChangeKind::Added,
        'D' => ChangeKind::Deleted,
        'R' | 'C' => ChangeKind::Renamed,
        _ => ChangeKind::Modified,
    }
}

fn run(dir: &Path, args: &[&str]) -> Result<String> {
    finish(
        Command::new("git")
            .args(args)
            .current_dir(dir)
            .output()
            .with_context(|| format!("running git {}", args.join(" ")))?,
        args,
    )
}

fn run_bytes(dir: &Path, args: &[&str]) -> Result<Vec<u8>> {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .with_context(|| format!("running git {}", args.join(" ")))?;
    if !output.status.success() {
        bail!("git {} failed", args.join(" "));
    }
    Ok(output.stdout)
}

fn run_with_input(dir: &Path, args: &[&str], input: &str) -> Result<String> {
    use std::io::Write;
    use std::process::Stdio;

    let mut child = Command::new("git")
        .args(args)
        .current_dir(dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| format!("running git {}", args.join(" ")))?;

    child
        .stdin
        .take()
        .context("no stdin for git")?
        .write_all(input.as_bytes())
        .context("writing the patch to git")?;

    finish(child.wait_with_output()?, args)
}

fn finish(output: std::process::Output, args: &[&str]) -> Result<String> {
    if !output.status.success() {
        bail!("git {} failed: {}", args.join(" "), String::from_utf8_lossy(&output.stderr).trim());
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;
