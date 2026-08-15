use std::path::{Path, PathBuf};

pub struct EditorSpec {
    pub id: &'static str,
    pub name: &'static str,
    pub command: &'static str,
    pub apps: &'static [&'static str],
}

pub const EDITORS: &[EditorSpec] = &[
    EditorSpec {
        id: "vscode",
        name: "Visual Studio Code",
        command: "code",
        apps: &["Visual Studio Code"],
    },
    EditorSpec {
        id: "vscode-insiders",
        name: "VS Code Insiders",
        command: "code-insiders",
        apps: &["Visual Studio Code - Insiders"],
    },
    EditorSpec { id: "cursor", name: "Cursor", command: "cursor", apps: &["Cursor"] },
    EditorSpec { id: "windsurf", name: "Windsurf", command: "windsurf", apps: &["Windsurf"] },
    EditorSpec { id: "zed", name: "Zed", command: "zed", apps: &["Zed", "Zed Preview"] },
    EditorSpec { id: "sublime", name: "Sublime Text", command: "subl", apps: &["Sublime Text"] },
    EditorSpec { id: "textmate", name: "TextMate", command: "mate", apps: &["TextMate"] },
    EditorSpec { id: "bbedit", name: "BBEdit", command: "bbedit", apps: &["BBEdit"] },
    EditorSpec { id: "nova", name: "Nova", command: "nova", apps: &["Nova"] },
    EditorSpec { id: "xcode", name: "Xcode", command: "xed", apps: &["Xcode"] },
    EditorSpec { id: "intellij", name: "IntelliJ IDEA", command: "idea", apps: &["IntelliJ IDEA"] },
    EditorSpec { id: "webstorm", name: "WebStorm", command: "webstorm", apps: &["WebStorm"] },
    EditorSpec { id: "goland", name: "GoLand", command: "goland", apps: &["GoLand"] },
    EditorSpec { id: "pycharm", name: "PyCharm", command: "pycharm", apps: &["PyCharm"] },
    EditorSpec { id: "rustrover", name: "RustRover", command: "rustrover", apps: &["RustRover"] },
    EditorSpec { id: "clion", name: "CLion", command: "clion", apps: &["CLion"] },
    EditorSpec { id: "rider", name: "Rider", command: "rider", apps: &["Rider"] },
];

pub fn find(id: &str) -> Option<&'static EditorSpec> {
    EDITORS.iter().find(|editor| editor.id == id)
}

pub fn bundle(spec: &EditorSpec, home: &Path) -> Option<PathBuf> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    let roots = [PathBuf::from("/Applications"), home.join("Applications")];
    roots
        .iter()
        .flat_map(|dir| spec.apps.iter().map(move |app| dir.join(format!("{app}.app"))))
        .find(|candidate| candidate.is_dir())
}

pub fn system_opener() -> &'static str {
    if cfg!(target_os = "macos") { "open" } else { "xdg-open" }
}

pub fn is_bundle(path: &Path) -> bool {
    path.extension().is_some_and(|extension| extension == "app")
}

#[cfg(test)]
#[path = "editors_tests.rs"]
mod tests;
