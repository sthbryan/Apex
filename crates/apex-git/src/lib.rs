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
        });
    }

    changes.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(changes)
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
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .with_context(|| format!("running git {}", args.join(" ")))?;

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
        assert_eq!(changes[1].kind, ChangeKind::Untracked);
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
