# LogSweeper

LogSweeper is a lightweight VS Code extension designed to cleanly and safely comment out all `console.log` statements in your active document.

## Features

- **Comment Out Log Statements:** Easily comment out all active `console.log(...)` statements in the active file using the command or the default shortcut.
- **Smart Nesting & Comment Checks:** The extension bypasses `console.log` calls that are already inside single-line (`//`) comments, multi-line (`/* ... */`) comments, or string literals.
- **Nested Parentheses Support:** Safely handles complex nested functions within logs, e.g. `console.log(myFunc(nested()));`.
- **Output Report:** Provides a dedicated VS Code Output panel (`LogSweeper`) listing details of all commented lines.

## Keybinding

Trigger LogSweeper:
- **Mac:** `Cmd + Shift + D`
- **Windows/Linux:** `Ctrl + Shift + D`

## Command

Run via the Command Palette (`Cmd + Shift + P` / `Ctrl + Shift + P`):
- `LogSweeper: Comment Out Console Logs`
