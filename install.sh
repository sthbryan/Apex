#!/usr/bin/env bash
# Apex installer — install the latest desktop build from GitHub Releases.
#
#   curl -fsSL https://raw.githubusercontent.com/sthbryan/apex/main/install.sh | bash
#
# Options (env):
#   APEX_VERSION=0.2.0        pin a version (without leading v)
#   APEX_DIR=~/.local/bin     AppImage install dir (Linux fallback)
#   APEX_FORCE_APPIMAGE=1     prefer AppImage over .deb on Debian/Ubuntu
set -euo pipefail

REPO="${APEX_REPO:-sthbryan/apex}"
BASE_URL="https://github.com/${REPO}/releases"
API_URL="https://api.github.com/repos/${REPO}/releases"
TMP_DIR=""

# ── colors (only if tty) ──────────────────────────────────────────
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

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

cleanup() {
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

banner() {
  printf '\n%sapex%s %sinstaller%s\n\n' "$BOLD$CYAN" "$RESET" "$DIM" "$RESET"
}

# ── platform ──────────────────────────────────────────────────────
detect_os() {
  local u
  u="$(uname -s | tr '[:upper:]' '[:lower:]')"
  case "$u" in
    linux*)  echo "linux" ;;
    darwin*) echo "macos" ;;
    msys*|mingw*|cygwin*) echo "windows" ;;
    *) fail "unsupported OS: $(uname -s)" ;;
  esac
}

detect_arch() {
  local m
  m="$(uname -m)"
  case "$m" in
    x86_64|amd64)  echo "amd64" ;;
    aarch64|arm64) echo "aarch64" ;;
    armv7l|armv7)  echo "armv7" ;;
    *) fail "unsupported architecture: $m" ;;
  esac
}

# ── version / download ────────────────────────────────────────────
resolve_version() {
  if [[ -n "${APEX_VERSION:-}" ]]; then
    echo "${APEX_VERSION#v}"
    return
  fi

  need_cmd curl
  local tag
  # Follow the /releases/latest redirect; no jq required.
  tag="$(
    curl -fsSLI -o /dev/null -w '%{url_effective}' \
      "${BASE_URL}/latest" 2>/dev/null \
      | sed -n 's|.*/tag/v\{0,1\}||p'
  )"
  if [[ -z "$tag" ]]; then
    # Fallback: GitHub API
    tag="$(
      curl -fsSL "${API_URL}/latest" \
        | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v\{0,1\}\([^"]*\)".*/\1/p' \
        | head -n1
    )"
  fi
  [[ -n "$tag" ]] || fail "could not resolve latest release (is the repo public?)"
  echo "$tag"
}

asset_url() {
  local version="$1" name="$2"
  echo "${BASE_URL}/download/v${version}/${name}"
}

download() {
  local url="$1" dest="$2"
  info "downloading ${BOLD}$(basename "$dest")${RESET}"
  if ! curl -fsSL --progress-bar -o "$dest" "$url"; then
    fail "download failed: $url
  check that the asset exists on ${BASE_URL}/tag/v${VERSION}"
  fi
  [[ -s "$dest" ]] || fail "downloaded file is empty: $dest"
}

# ── installers ────────────────────────────────────────────────────
install_macos_dmg() {
  local version="$1" arch="$2"
  local name="Apex_${version}_${arch}.dmg"
  local url dest app_src mountpoint

  if [[ "$arch" != "aarch64" ]]; then
    fail "macOS ${arch} is not published yet (only Apple Silicon aarch64 .dmg).
  Download manually from ${BASE_URL} or build from source."
  fi

  dest="${TMP_DIR}/${name}"
  download "$(asset_url "$version" "$name")" "$dest"

  mountpoint="$(mktemp -d "${TMP_DIR}/dmg.XXXXXX")"
  info "mounting DMG"
  # hdiutil prints the device on the first line of attach output
  local attach_out device
  attach_out="$(hdiutil attach -nobrowse -readonly -mountpoint "$mountpoint" "$dest")"
  device="$(echo "$attach_out" | awk 'NR==1{print $1}')"

  app_src="$(find "$mountpoint" -maxdepth 2 -name '*.app' -type d | head -n1)"
  [[ -n "$app_src" ]] || {
    hdiutil detach "$mountpoint" >/dev/null 2>&1 || true
    fail "no .app found inside $name"
  }

  local app_name dest_app
  app_name="$(basename "$app_src")"
  dest_app="/Applications/${app_name}"

  info "installing to ${BOLD}${dest_app}${RESET}"
  if [[ -d "$dest_app" ]]; then
    warn "replacing existing ${app_name}"
    rm -rf "$dest_app"
  fi
  # ditto preserves resource forks / codesign better than cp -R
  ditto "$app_src" "$dest_app"

  hdiutil detach "$mountpoint" >/dev/null 2>&1 || \
    hdiutil detach "$device" >/dev/null 2>&1 || true

  # Clear Gatekeeper quarantine so first open is not blocked
  # (-d delete, -r recursive — required for .app bundles)
  if command -v xattr >/dev/null 2>&1; then
    info "clearing quarantine (xattr -dr com.apple.quarantine …)"
    xattr -dr com.apple.quarantine "$dest_app" 2>/dev/null || true
  fi

  ok "installed ${app_name} → /Applications"
  info "open with: ${BOLD}open -a Apex${RESET}"
  info "if macOS still blocks it, run:"
  printf '    %sxattr -dr com.apple.quarantine %s%s\n' "$BOLD" "$dest_app" "$RESET"
}

is_debian_like() {
  [[ -f /etc/debian_version ]] || \
    command -v dpkg >/dev/null 2>&1
}

install_linux_deb() {
  local version="$1" arch="$2"
  local name="Apex_${version}_${arch}.deb"
  local dest="${TMP_DIR}/${name}"

  download "$(asset_url "$version" "$name")" "$dest"

  info "installing .deb (needs sudo)"
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y "$dest"
  else
    sudo dpkg -i "$dest" || true
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get install -f -y
    fi
  fi
  ok "installed Apex via dpkg"
  info "run: ${BOLD}apex-desktop${RESET}  (or open from your app menu)"
}

retire_old_appimage() {
  local stale="$1"
  if [[ -f "$stale" && ! -L "$stale" ]]; then
    warn "removing the old ${stale} so the apex command is free"
    rm -f "$stale"
  fi
}

install_linux_appimage() {
  local version="$1" arch="$2"
  local name="Apex_${version}_${arch}.AppImage"
  local dest_dir dest

  dest_dir="${APEX_DIR:-${HOME}/.local/bin}"
  mkdir -p "$dest_dir"
  dest="${dest_dir}/apex-desktop"

  download "$(asset_url "$version" "$name")" "${TMP_DIR}/${name}"
  install -m 755 "${TMP_DIR}/${name}" "$dest"
  retire_old_appimage "${dest_dir}/apex"

  ok "installed AppImage → ${dest}"
  if ! echo ":$PATH:" | grep -q ":${dest_dir}:"; then
    warn "${dest_dir} is not on your PATH"
    info "add:  ${BOLD}export PATH=\"${dest_dir}:\$PATH\"${RESET}"
  fi
  info "run: ${BOLD}${dest}${RESET}"
}

install_linux() {
  local version="$1" arch="$2"

  if [[ "$arch" != "amd64" ]]; then
    fail "Linux ${arch} is not published yet (only amd64 .deb / .AppImage).
  Download manually from ${BASE_URL} or build from source."
  fi

  if [[ -z "${APEX_FORCE_APPIMAGE:-}" ]] && is_debian_like; then
    install_linux_deb "$version" "$arch"
  else
    if [[ -n "${APEX_FORCE_APPIMAGE:-}" ]]; then
      info "APEX_FORCE_APPIMAGE set — using AppImage"
    else
      info "non-Debian Linux — using AppImage"
    fi
    install_linux_appimage "$version" "$arch"
  fi
}

# ── main ──────────────────────────────────────────────────────────
main() {
  banner
  need_cmd curl
  need_cmd uname

  local os arch version
  os="$(detect_os)"
  arch="$(detect_arch)"
  version="$(resolve_version)"
  VERSION="$version" # used in error messages

  info "os ${BOLD}${os}${RESET}  arch ${BOLD}${arch}${RESET}  version ${BOLD}v${version}${RESET}"
  printf '\n'

  TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/apex-install.XXXXXX")"

  case "$os" in
    macos)
      need_cmd hdiutil
      need_cmd ditto
      install_macos_dmg "$version" "$arch"
      ;;
    linux)
      install_linux "$version" "$arch"
      ;;
    windows)
      fail "Windows is not supported by this installer yet.
  Grab an .msi / .exe from ${BASE_URL} when published, or build from source."
      ;;
  esac

  printf '\n'
  ok "done"
  printf '\n'
}

main "$@"
