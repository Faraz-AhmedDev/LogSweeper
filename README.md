# LogSweeper

LogSweeper is a professional, high-performance VS Code extension designed to cleanly manage debug log statements across multi-language projects. It can comment, uncomment, toggle, or permanently delete log statements recursively in files, folders, or your entire workspace.

## Features

- **Toggle Comment/Uncomment**: Toggles log statements between commented and uncommented states.
- **Smart Formatting Preservation**: Preserves code formatting, semicolons, and original line indentation perfectly.
- **Permanent Log Deletion**: Cleanly removes log statements with user confirmation. Deletes the entire line if the log statement is the only code on that line (no empty line litter).
- **Interactive Changes Preview**: Show matches, file list, and line details before making changes.
- **Native Diff Integration**: Double-click any file in the preview list to view a native side-by-side Git-style diff of proposed changes.
- **Safe Backup & Restore**: Automatically backs up files to `.logsweeper-backups/` inside the workspace with a JSON manifest. Easily restore files using `LogSweeper: Restore Backup`.
- **Automatic Backup Retention Policies**: Cleans up old backups based on age (e.g. 7 days) and count limit (e.g. 50 files) to keep workspaces clean.
- **Recursion & Exclusions**: Fast scans using VS Code's index-level workspace search. Skips generated folders like `node_modules`, `.git`, `dist`, `build`, `.next`, etc., or your own custom exclusions.
- **Ignore Rules**: Skip individual statements by adding `// logsweeper-ignore` or `/* logsweeper-ignore */` (or language-specific equivalents like `# logsweeper-ignore`) above or inline with the statement.

## Supported Languages & Log Types

| Language | Log Patterns | Comment Format | File Extensions |
|---|---|---|---|
| **JS / TS / Node** | `console.log`, `console.info`, `console.debug`, `console.warn`, `console.error`, `console.trace`, `debugger` | `//` or `/* */` | `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts`, `.tsx` |
| **React / React Native** | Same as above | `//` or `/* */` | Same as above |
| **Vue** | Same as above | `//` or `/* */` (script), `<!-- -->` (template) | `.vue` |
| **Angular** | Same as above | `//` or `/* */` | `.ts` |
| **Dart** | `print()` | `//` or `/* */` | `.dart` |
| **Java** | `System.out.println()`, `println()` | `//` or `/* */` | `.java` |
| **Kotlin** | `println()`, `print()` | `//` or `/* */` | `.kt`, `.kts` |
| **Swift** | `print()`, `NSLog()` | `//` or `/* */` | `.swift` |
| **C#** | `Console.WriteLine()`, `System.Console.WriteLine()`, `Debug.WriteLine()`, `Console.Write()` | `//` or `/* */` | `.cs` |
| **PHP** | `print_r()`, `var_dump()`, `echo`, `print()` | `//`, `#`, or `/* */` | `.php` |
| **Python** | `print()` | `#` or `""" """` | `.py` |
| **Go** | `fmt.Println()`, `println()`, `print()` | `//` or `/* */` | `.go` |
| **Rust** | `println!()`, `print!()` | `//` or `/* */` | `.rs` |

## Keybindings

| Command | macOS Shortcut | Windows / Linux Shortcut |
|---|---|---|
| **Comment Logs** | `Cmd + Alt + C` | `Ctrl + Alt + C` |
| **Uncomment Logs** | `Cmd + Alt + U` | `Ctrl + Alt + U` |
| **Toggle Logs** | `Cmd + Alt + T` | `Ctrl + Alt + T` |
| **Delete Logs** | `Cmd + Alt + E` | `Ctrl + Alt + E` |
| **Restore Backup** | `Cmd + Alt + R` | `Ctrl + Alt + R` |

## Configuration Settings

You can customize LogSweeper behavior under **Settings > Extensions > LogSweeper**:

- `logsweeper.commentMode`: Choose comment style: `'block'` (`/* ... */`) or `'line'` (`// ...`). (Default: `'block'`).
- `logsweeper.backupEnabled`: Backup files before cleaning. (Default: `true`).
- `logsweeper.backupFolder`: Folder path for backups. (Default: `".logsweeper-backups"`).
- `logsweeper.backupLimit`: Max backups to store. (Default: `50`).
- `logsweeper.backupMaxAgeDays`: Max age in days to retain backups. (Default: `7`).
- `logsweeper.workspaceExclusions`: Folder names to exclude from recursive searches.
- `logsweeper.previewBeforeApplying`: Enables the interactive preview before writing files. (Default: `true`).
- Include specific console methods: `includeConsoleWarn`, `includeConsoleError`, `includeConsoleDebug`, `includeConsoleInfo`, `includeConsoleTrace`, `includeDebuggerStatements`.
