#!/usr/bin/env bash
# Apex uninstaller — remove the desktop app, the daemon and, if you say so, your settings.
#
#   curl -fsSL https://raw.githubusercontent.com/sthbryan/apex/main/uninstall.sh | bash
#
# Options:
#   --all             remove the settings too, without asking
#   --keep-settings   keep ~/.apex and the webview store
#   --yes             do not ask for the final confirmation
set -euo pipefail

IDENTIFIER="com.justcallmebryan.apex"
WIPE=""
ASSUME_YES=""

for word in "$@"; do
  case "$word" in
    --all) WIPE="yes" ;;
    --keep-settings) WIPE="no" ;;
    --yes) ASSUME_YES="yes" ;;
    *) printf 'unknown option: %s\n' "$word" >&2; exit 2 ;;
  esac
done

if [[ -t 1 ]] || [[ -n "${FORCE_COLOR:-}" ]]; then
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  RED=$'\033[31m'
  GREEN=$'\033[32m'
  YELLOW=$'\033[33m'
  CYAN=$'\033[36m'
  RESET=$'\033[0m'
else
  BOLD="" DIM="" RED="" GREEN="" YELLOW="" CYAN="" RESET=""
fi

info()  { printf '%s●%s %s\n' "$CYAN" "$RESET" "$*"; }
ok()    { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn()  { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
fail()  { printf '%s✗%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

banner() {
  printf '\n%sapex%s %suninstaller%s\n\n' "$BOLD$CYAN" "$RESET" "$DIM" "$RESET"
}

stop_daemon() {
  if command -v apex >/dev/null 2>&1; then
    info "stopping the daemon"
    apex stop >/dev/null 2>&1 || true
  fi
  if pgrep -x apexd >/dev/null 2>&1; then
    warn "apexd is still up, ending it"
    pkill -x apexd || true
    sleep 1
  fi
  if pgrep -x apexd >/dev/null 2>&1; then
    fail "apexd will not stop. Close it yourself and run this again."
  fi
  ok "the daemon is down"
}

app_paths() {
  local found=()
  [[ -d "/Applications/Apex.app" ]] && found+=("/Applications/Apex.app")
  [[ -e "${HOME}/.local/bin/apex" ]] && found+=("${HOME}/.local/bin/apex")
  [[ -e "${HOME}/.local/bin/apex-desktop" ]] && found+=("${HOME}/.local/bin/apex-desktop")
  printf '%s\n' "${found[@]+"${found[@]}"}"
}

data_paths() {
  local found=()
  local candidates=(
    "${HOME}/.apex"
    "${HOME}/Library/Application Support/${IDENTIFIER}"
    "${HOME}/Library/Caches/${IDENTIFIER}"
    "${HOME}/Library/WebKit/${IDENTIFIER}"
    "${HOME}/Library/HTTPStorages/${IDENTIFIER}"
    "${HOME}/Library/Preferences/${IDENTIFIER}.plist"
    "${HOME}/Library/Saved Application State/${IDENTIFIER}.savedState"
    "${HOME}/.config/${IDENTIFIER}"
    "${HOME}/.cache/${IDENTIFIER}"
    "${HOME}/.local/share/${IDENTIFIER}"
  )
  local candidate
  for candidate in "${candidates[@]}"; do
    [[ -e "$candidate" ]] && found+=("$candidate")
  done
  printf '%s\n' "${found[@]+"${found[@]}"}"
}

ask_about_settings() {
  if [[ -n "$WIPE" ]]; then
    return
  fi
  printf 'Also remove your settings, projects and history? [y/N] '
  local said
  read -r said </dev/tty || said=""
  case "$said" in
    y|Y|yes) WIPE="yes" ;;
    *) WIPE="no" ;;
  esac
}

erase() {
  local path="$1"
  [[ -n "$path" ]] || return 0
  rm -rf "$path"
}

packaged() {
  command -v dpkg >/dev/null 2>&1 && dpkg -s apex >/dev/null 2>&1
}

main() {
  banner

  local doomed=()
  local path
  while IFS= read -r path; do
    [[ -n "$path" ]] && doomed+=("$path")
  done < <(app_paths)

  ask_about_settings

  if [[ "$WIPE" == "yes" ]]; then
    while IFS= read -r path; do
      [[ -n "$path" ]] && doomed+=("$path")
    done < <(data_paths)
  fi

  if [[ ${#doomed[@]} -eq 0 ]]; then
    info "there is nothing left to remove"
  else
    printf '\nthis will delete:\n'
    for path in "${doomed[@]}"; do
      printf '  %s\n' "$path"
    done
    printf '\n'
  fi

  if [[ -z "$ASSUME_YES" ]]; then
    printf 'type %suninstall%s to go ahead: ' "$BOLD" "$RESET"
    local said
    read -r said </dev/tty || said=""
    if [[ "$said" != "uninstall" ]]; then
      info "nothing was touched"
      exit 1
    fi
  fi

  stop_daemon

  for path in "${doomed[@]+"${doomed[@]}"}"; do
    erase "$path"
  done

  if packaged; then
    warn "Apex was installed with dpkg, remove it with:"
    printf '    %ssudo apt remove apex%s\n' "$BOLD" "$RESET"
  fi

  ok "Apex is gone"
  if [[ "$WIPE" != "yes" ]]; then
    info "your settings are still in ${BOLD}~/.apex${RESET}"
  fi
}

main "$@"
