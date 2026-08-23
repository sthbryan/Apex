mod client;
mod commands;
#[cfg(target_os = "macos")]
mod menu;
mod state;

use apex_core::ApexPaths;
use client::DaemonClient;
use tauri::Manager;

use state::AppState;

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "apex_desktop_lib=info".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let paths = ApexPaths::discover()?;
            let daemon = tauri::async_runtime::block_on(DaemonClient::attach(&paths.socket));
            if let Err(error) = &daemon {
                tracing::warn!(%error, "could not reach apexd at startup");
            }
            #[cfg(target_os = "macos")]
            menu::install(app.handle())?;
            app.manage(AppState {
                daemon: std::sync::Mutex::new(daemon.ok()),
                socket: paths.socket,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::daemon_version,
            commands::host_platform,
            commands::set_badge,
            commands::set_window_material,
            commands::subscribe_output,
            commands::subscribe_events,
            commands::list_agents,
            commands::list_sessions,
            commands::list_projects,
            commands::open_project,
            commands::remove_project,
            commands::save_layout,
            commands::load_layout,
            commands::read_metrics,
            commands::kill_process,
            commands::set_idle_grace,
            commands::list_history,
            commands::list_directory,
            commands::read_file,
            commands::write_file,
            commands::search_files,
            commands::list_editors,
            commands::open_externally,
            commands::open_url,
            commands::resume_session,
            commands::create_session,
            commands::race_session,
            commands::attach_session,
            commands::send_input,
            commands::detach_session,
            commands::tell_session,
            commands::resize_session,
            commands::close_session,
            commands::session_transcript,
            commands::git_status,
            commands::git_diff,
            commands::git_log,
            commands::git_hunks,
            commands::git_images,
            commands::list_worktrees,
            commands::git_branches,
            commands::git_checkout,
            commands::git_pending,
            commands::git_reject_hunk,
            commands::git_rejects,
            commands::git_restore_reject,
            commands::git_clear_rejects,
            commands::git_stage,
            commands::git_stage_hunk,
            commands::git_commit,
            commands::git_sync,
            commands::merge_worktree,
            commands::remove_worktree,
            commands::list_tasks,
            commands::run_task,
            commands::acp_transcript,
            commands::acp_prompt,
            commands::acp_cancel,
            commands::acp_decide,
            commands::browser_open,
            commands::browser_close,
            commands::browser_bounds,
            commands::browser_show,
            commands::browser_run,
            commands::browser_probe,
            commands::browser_report,
            commands::browser_forget,
            commands::acp_choose,
            commands::mcp_adopt,
            commands::context_list,
            commands::context_read,
            commands::context_write,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Apex");
}
