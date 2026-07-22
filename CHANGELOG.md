# Change Log

All notable changes to the "logsweeper" extension are documented here.

## [0.1.0] - 2026-07-22

### Added
- **Multi-language Support**: Fully modular parsing rules for JavaScript, TypeScript, React, Vue, Angular, Dart, Java, Kotlin, Swift, C#, PHP, Python, Go, and Rust.
- **Toggling, Commenting, and Uncommenting**: Toggle logs back and forth with original formatting preservation.
- **Permanent Log Deletion**: Cleanly delete log statements and automatically sweep empty lines.
- **Interactive Changes Preview**: Multi-select panel to review, apply, or skip file changes before writing.
- **Native Diff Editor Integration**: Double-click files in the preview panel to view proposed modifications in VS Code's side-by-side diff.
- **Backup & Restore System**: Automated backups to `.logsweeper-backups/` with a local `backups.json` manifest. Added restoration command and automatic cleaning retention.
- **Ignore Rules**: Support for skipping statements prefixed or annotated inline with `logsweeper-ignore`.
- **Exclusions & Recursion**: Search subfolders and workspaces recursively using optimized globbing, and skip generated directories (`node_modules`, `.next`, `dist`, etc.) by default.
- **Detailed Statistics**: Scan summary showing files scanned/modified, counts of actions, and duration, outputting to a dedicated Output channel.
- **Default Shortcuts**: Conflict-free mnemonic keybindings for Commenting (`cmd+alt+c`), Uncommenting (`cmd+alt+u`), Toggling (`cmd+alt+t`), Deletion (`cmd+alt+e`), and Restoring backups (`cmd+alt+r`).
- **Interactive Preview Bug Fix**: Resolved a bug where the interactive changes preview dialog (QuickPick) was not shown (`quickPick.show()` was missing), causing the sweep commands to hang indefinitely.
- **Detailed Diagnostics**: Added real-time diagnostics logging to the "LogSweeper" Output panel.
- **Comprehensive Settings**: Preferences for comment mode, backup retention, preview overrides, and specific JS/TS log filters.