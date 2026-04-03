# Releasing Kilo Code

Releases are created by pushing a version tag such as `v8.3.1`. GitHub Actions builds the supported macOS and Linux binaries, publishes checksums, generates build provenance, and attaches everything to a GitHub Release.

## Trigger

```bash
git tag v8.3.1
git push origin v8.3.1
```

The active workflow is [`release.yml`](./.github/workflows/release.yml).

## What The Workflow Publishes

The workflow runs two build jobs and one release job:

- `build-linux` on `ubuntu-latest`
- `build-macos` on `macos-latest`
- `release` on `ubuntu-latest`

### Linux assets

- `kilo-linux-x64.tar.gz`
- `kilo-linux-x64-baseline.tar.gz`
- `kilo-linux-arm64.tar.gz`
- `kilo-linux-x64-musl.tar.gz`
- `kilo-linux-x64-baseline-musl.tar.gz`
- `kilo-linux-arm64-musl.tar.gz`

### macOS assets

- `kilo-darwin-arm64.zip`
- `kilo-darwin-x64.zip`
- `kilo-darwin-x64-baseline.zip`

### Extra release assets

- `kilo-checksums.txt`
- GitHub build provenance attestations for the archived binaries

## Installer

Users can install with a one-line command:

```bash
curl -fsSL https://raw.githubusercontent.com/Ayush-Kotlin-Dev/kilocode/main/install | bash
```

To install from a non-default branch:

```bash
curl -fsSL https://raw.githubusercontent.com/Ayush-Kotlin-Dev/kilocode/support/kali/install | bash
```

The installer:

- detects the current platform and CPU
- prefers the most specific asset for the machine
- falls back to a compatible asset when a variant is unavailable
- verifies the archive against `kilo-checksums.txt` when checksum tools are present
- installs `kilo` into `$HOME/.kilo/bin`
- adds `$HOME/.kilo/bin` to the shell `PATH` when possible

## Current GitHub Actions Setup

The workflow uses current major versions of the main release actions:

- `actions/checkout@v6`
- `actions/upload-artifact@v5`
- `actions/download-artifact@v5`
- `softprops/action-gh-release@v2`
- `actions/attest-build-provenance@v3`

## Notes

- Releases are tag-driven, not `workflow_dispatch`-driven.
- The workflow is focused on GitHub Releases and curl-based installs.
- Package registry publishing such as npm, Homebrew, Docker, or AUR is not part of the current release workflow.
