# Changelog

## 1.1.0 — 2026-10-29

- Lock screen: idle auto-lock, password unlock, in-place password change
- Default password configurable through the plugin config (host half serves it over `/plugins/birds-screensaver/config`)
- Visible lock trigger: floating 🔒 button at the bottom-right
- Alternate shortcut `Ctrl+Alt+L` alongside `Ctrl+Shift+L`
- Install/upgrade resilience: files live in `~/.dsh/local-plugins`, mounted through a junction, so DSH upgrades do not remove them
- `install.mjs` / `uninstall.mjs` (cross-platform, idempotent)
- Fixed: registration must use the `insert` patch form; a bare `- id:` row is silently skipped by the Loader

## 1.0.0 — 2026-10-28

- Initial release: boids flock screensaver (3 flocks, 2 hawks, 420 birds)
- Brand wordmark and clock
- Full-screen idle screensaver with any-input dismiss
