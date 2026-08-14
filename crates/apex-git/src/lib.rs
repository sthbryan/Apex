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
    std::fs::read_to_string(path)
        .map(|text| text.lines().count() as u32)
        .unwrap_or_default()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scope {
    Unstaged,
    Staged,
    Both,
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

pub fn staged_paths(dir: &Path) -> Result<Vec<String>> {
    Ok(status(dir)?
        .into_iter()
        .filter(|change| change.staged)
        .map(|change| change.path)
        .collect())
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
        run(root, &["branch", "-D", branch])
            .with_context(|| format!("deleting {branch}"))?;
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
            let files: Vec<String> =
                unmerged.lines().map(str::trim).filter(|line| !line.is_empty()).map(str::to_owned).collect();
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

fn exclude_worktrees(root: &Path) -> Result<()> {
    let git_dir = run(root, &["rev-parse", "--git-common-dir"])?;
    let info = Path::new(git_dir.trim()).to_path_buf();
    let info = if info.is_absolute() { info } else { root.join(info) };
    let exclude = info.join("info").join("exclude");

    let current = std::fs::read_to_string(&exclude).unwrap_or_default();
    let entry = format!("/{WORKTREE_DIR}/");
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
        bail!(
            "git {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repo() -> tempfile::TempDir {
        let dir = tempfile::tempdir().expect("tempdir");
        let root = dir.path();
        run(root, &["init", "--initial-branch=main"]).expect("init");
        run(root, &["config", "user.email", "test@apex.dev"]).expect("email");
        run(root, &["config", "user.name", "Apex Test"]).expect("name");
        std::fs::write(root.join("README.md"), "# sample\n").expect("readme");
        run(root, &["add", "."]).expect("add");
        run(root, &["commit", "-m", "first"]).expect("commit");
        dir
    }

    #[test]
    fn a_repository_is_recognised_with_its_branch() {
        let dir = repo();
        assert!(is_repo(dir.path()));
        assert_eq!(current_branch(dir.path()).expect("branch"), "main");
        assert!(!is_repo(&std::env::temp_dir().join("definitely-not-a-repo")));
    }

    #[test]
    fn status_reports_modified_and_untracked_files() {
        let dir = repo();
        std::fs::write(dir.path().join("README.md"), "# changed\n").expect("write");
        std::fs::write(dir.path().join("new.txt"), "hello\n").expect("write");

        let changes = status(dir.path()).expect("status");
        assert_eq!(changes.len(), 2);
        assert_eq!(changes[0].path, "README.md");
        assert_eq!(changes[0].kind, ChangeKind::Modified);
        assert!(!changes[0].staged);
        assert_eq!((changes[0].added, changes[0].removed), (1, 1));
        assert_eq!(changes[1].kind, ChangeKind::Untracked);
        assert_eq!((changes[1].added, changes[1].removed), (1, 0));
    }

    #[test]
    fn a_diff_shows_the_change() {
        let dir = repo();
        std::fs::write(dir.path().join("README.md"), "# changed\n").expect("write");
        let patch = diff(dir.path(), "README.md").expect("diff");
        assert!(patch.contains("-# sample"));
        assert!(patch.contains("+# changed"));
    }

    #[test]
    fn an_untracked_file_still_has_a_diff() {
        let dir = repo();
        std::fs::write(dir.path().join("new.txt"), "hello\n").expect("write");
        assert!(diff(dir.path(), "new.txt").expect("diff").contains("+hello"));
    }

    #[test]
    fn the_log_carries_the_summary_and_the_author() {
        let dir = repo();
        std::fs::write(dir.path().join("second.txt"), "more\n").expect("write");
        run(dir.path(), &["add", "."]).expect("add");
        run(dir.path(), &["commit", "-m", "second commit"]).expect("commit");

        let commits = log(dir.path(), 10).expect("log");
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].summary, "second commit");
        assert_eq!(commits[0].author, "Apex Test");
        assert!(commits[0].when > 0);
        assert_eq!(commits[0].short.len(), 7);
        assert!(commits[0].refs.contains("HEAD"));
        assert_eq!(commits[1].summary, "first");
    }

    #[test]
    fn a_commit_can_be_shown_whole_or_by_file() {
        let dir = repo();
        std::fs::write(dir.path().join("README.md"), "# changed\n").expect("write");
        std::fs::write(dir.path().join("other.txt"), "hello\n").expect("write");
        run(dir.path(), &["add", "."]).expect("add");
        run(dir.path(), &["commit", "-m", "touch two files"]).expect("commit");
        let head = &log(dir.path(), 1).expect("log")[0].id;

        let whole = show(dir.path(), head, None).expect("show");
        assert!(whole.contains("+# changed"));
        assert!(whole.contains("+hello"));

        let single = show(dir.path(), head, Some("other.txt")).expect("show");
        assert!(single.contains("+hello"));
        assert!(!single.contains("+# changed"));
    }

    #[test]
    fn staging_moves_a_file_in_and_out_of_the_index() {
        let dir = repo();
        std::fs::write(dir.path().join("README.md"), "# changed\n").expect("write");

        stage(dir.path(), &["README.md".to_owned()]).expect("stage");
        assert_eq!(staged_paths(dir.path()).expect("staged"), vec!["README.md".to_owned()]);

        unstage(dir.path(), &["README.md".to_owned()]).expect("unstage");
        assert!(staged_paths(dir.path()).expect("staged").is_empty());
        assert_eq!(status(dir.path()).expect("status").len(), 1);
    }

    #[test]
    fn the_diff_separates_what_is_staged_from_what_is_not() {
        let dir = repo();
        std::fs::write(dir.path().join("README.md"), "# staged\n").expect("write");
        stage(dir.path(), &["README.md".to_owned()]).expect("stage");
        std::fs::write(dir.path().join("README.md"), "# staged then edited\n").expect("write");

        let staged = diff_scoped(dir.path(), "README.md", Scope::Staged).expect("staged");
        assert!(staged.contains("+# staged"));
        assert!(!staged.contains("then edited"));

        let unstaged = diff_scoped(dir.path(), "README.md", Scope::Unstaged).expect("unstaged");
        assert!(unstaged.contains("+# staged then edited"));

        let both = diff_scoped(dir.path(), "README.md", Scope::Both).expect("both");
        assert!(both.contains("+# staged then edited"));
        assert!(!both.contains("-# staged\n"));
    }

    #[test]
    fn a_commit_only_takes_what_was_staged() {
        let dir = repo();
        std::fs::write(dir.path().join("README.md"), "# in\n").expect("write");
        std::fs::write(dir.path().join("left-out.txt"), "not yet\n").expect("write");
        stage(dir.path(), &["README.md".to_owned()]).expect("stage");

        let commit = commit(dir.path(), "docs: solo el readme").expect("commit");
        assert_eq!(commit.summary, "docs: solo el readme");

        let shown = show(dir.path(), &commit.id, None).expect("show");
        assert!(shown.contains("README.md"));
        assert!(!shown.contains("left-out.txt"));
        assert_eq!(status(dir.path()).expect("status").len(), 1);
    }

    #[test]
    fn an_empty_message_is_refused_before_touching_git() {
        let dir = repo();
        std::fs::write(dir.path().join("README.md"), "# in\n").expect("write");
        stage(dir.path(), &["README.md".to_owned()]).expect("stage");

        assert!(commit(dir.path(), "   ").is_err());
        assert_eq!(log(dir.path(), 10).expect("log").len(), 1);
    }

    #[test]
    fn a_single_hunk_can_be_staged_on_its_own() {
        let dir = repo();
        let lines: Vec<String> = (1..=20).map(|n| format!("line {n}")).collect();
        std::fs::write(dir.path().join("many.txt"), format!("{}\n", lines.join("\n")))
            .expect("write");
        run(dir.path(), &["add", "."]).expect("add");
        run(dir.path(), &["commit", "-m", "many"]).expect("commit");

        let mut edited = lines.clone();
        edited[1] = "line 2 touched".into();
        edited[18] = "line 19 touched".into();
        std::fs::write(dir.path().join("many.txt"), format!("{}\n", edited.join("\n")))
            .expect("write");

        let patch = diff_scoped(dir.path(), "many.txt", Scope::Unstaged).expect("diff");
        let hunks = split_hunks(&patch);
        assert_eq!(hunks.len(), 2);

        apply_to_index(dir.path(), &hunks[0], false).expect("apply");
        let staged = diff_scoped(dir.path(), "many.txt", Scope::Staged).expect("staged");
        assert!(staged.contains("+line 2 touched"));
        assert!(!staged.contains("+line 19 touched"));

        apply_to_index(dir.path(), &hunks[0], true).expect("reverse");
        assert!(staged_paths(dir.path()).expect("staged").is_empty());
    }

    #[test]
    fn a_worktree_is_isolated_and_listed() {
        let dir = repo();
        let tree = add_worktree(dir.path(), "codex").expect("worktree");
        assert_eq!(tree.branch, "apex/codex");
        assert!(tree.path.join("README.md").is_file());
        assert_eq!(current_branch(&tree.path).expect("branch"), "apex/codex");

        std::fs::write(tree.path.join("README.md"), "# from the agent\n").expect("write");
        assert!(status(dir.path()).expect("status").is_empty());
        assert_eq!(status(&tree.path).expect("status").len(), 1);

        assert!(
            list_worktrees(dir.path())
                .expect("list")
                .iter()
                .any(|entry| entry.branch == "apex/codex")
        );
    }

    #[test]
    fn worktrees_are_excluded_from_the_repository() {
        let dir = repo();
        add_worktree(dir.path(), "codex").expect("worktree");
        assert!(status(dir.path()).expect("status").is_empty());

        let exclude = std::fs::read_to_string(dir.path().join(".git/info/exclude")).expect("read");
        assert!(exclude.contains("/.apex/worktrees/"));
    }

    #[test]
    fn work_merges_back_into_the_base_branch() {
        let dir = repo();
        let tree = add_worktree(dir.path(), "codex").expect("worktree");
        std::fs::write(tree.path.join("feature.txt"), "done\n").expect("write");
        run(&tree.path, &["add", "."]).expect("add");
        run(&tree.path, &["commit", "-m", "feature"]).expect("commit");

        assert_eq!(merge(dir.path(), "apex/codex").expect("merge"), MergeOutcome::Merged);
        assert!(dir.path().join("feature.txt").is_file());
    }

    #[test]
    fn a_conflict_is_reported_instead_of_failing() {
        let dir = repo();
        let tree = add_worktree(dir.path(), "codex").expect("worktree");
        std::fs::write(tree.path.join("README.md"), "# theirs\n").expect("write");
        run(&tree.path, &["commit", "-am", "theirs"]).expect("commit");

        std::fs::write(dir.path().join("README.md"), "# ours\n").expect("write");
        run(dir.path(), &["commit", "-am", "ours"]).expect("commit");

        match merge(dir.path(), "apex/codex").expect("merge") {
            MergeOutcome::Conflicted { files } => assert_eq!(files, vec!["README.md".to_owned()]),
            other => panic!("expected a conflict, got {other:?}"),
        }

        abort_merge(dir.path()).expect("abort");
        assert!(status(dir.path()).expect("status").is_empty());
    }

    #[test]
    fn removing_a_worktree_can_drop_its_branch() {
        let dir = repo();
        let tree = add_worktree(dir.path(), "codex").expect("worktree");
        remove_worktree(dir.path(), &tree.path, Some(&tree.branch)).expect("remove");

        assert!(!tree.path.exists());
        assert!(run(dir.path(), &["rev-parse", "--verify", "apex/codex"]).is_err());
    }

    #[test]
    fn titles_become_safe_branch_slugs() {
        assert_eq!(slugify("Claude 2"), "claude-2");
        assert_eq!(slugify("  opencode//shell "), "opencode-shell");
    }
}
