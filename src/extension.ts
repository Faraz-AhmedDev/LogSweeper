import * as vscode from 'vscode';

// Create a new Output Channel which will show up in the VS Code bottom panel
const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel("LogSweeper");

interface LogMatch {
	start: number;
	end: number;
	text: string;
	line: number;
}

/**
 * Robustly finds all non-commented console.log statements.
 * Handles nested parentheses, line comments, block comments, and string literals.
 */
function findConsoleLogs(text: string): LogMatch[] {
	const matches: LogMatch[] = [];
	let inString: string | null = null;
	let inComment: 'single' | 'multi' | null = null;
	let i = 0;
	let currentLine = 1;

	while (i < text.length) {
		const char = text[i];
		const nextChar = text[i + 1] || '';

		if (char === '\n') {
			currentLine++;
		}

		// Comment End checks
		if (inComment === 'single' && char === '\n') {
			inComment = null;
		} else if (inComment === 'multi' && char === '*' && nextChar === '/') {
			inComment = null;
			i += 2;
			continue;
		}

		if (inComment) {
			i++;
			continue;
		}

		// String End checks
		if (inString) {
			if (char === '\\') {
				// Skip the escape sequence entirely
				i += 2;
				continue;
			}
			if (char === inString) {
				inString = null;
			}
			i++;
			continue;
		}

		// String Start checks
		if (char === "'" || char === '"' || char === '`') {
			inString = char;
			i++;
			continue;
		}

		// Comment Start checks
		if (char === '/' && nextChar === '/') {
			inComment = 'single';
			i += 2;
			continue;
		} else if (char === '/' && nextChar === '*') {
			inComment = 'multi';
			i += 2;
			continue;
		}

		// Check console.log(
		if (text.startsWith('console.log', i)) {
			// Find opening parenthesis after optional whitespace
			let checkIdx = i + 11;
			while (checkIdx < text.length && /\s/.test(text[checkIdx])) {
				checkIdx++;
			}

			if (text[checkIdx] === '(') {
				const startIdx = i;
				let parenCount = 1;
				let j = checkIdx + 1;
				let innerString: string | null = null;

				while (j < text.length && parenCount > 0) {
					const c = text[j];

					if (innerString) {
						if (c === '\\') {
							j += 2;
							continue;
						}
						if (c === innerString) {
							innerString = null;
						}
						j++;
						continue;
					}

					if (c === "'" || c === '"' || c === '`') {
						innerString = c;
						j++;
						continue;
					}

					if (c === '(') {
						parenCount++;
					} else if (c === ')') {
						parenCount--;
					}
					j++;
				}

				if (parenCount === 0) {
					let endIdx = j;
					// Consume trailing whitespaces (except newlines) and then trailing semicolon if present
					while (endIdx < text.length && /\s/.test(text[endIdx]) && text[endIdx] !== '\n') {
						endIdx++;
					}
					if (text[endIdx] === ';') {
						endIdx++;
					}

					const matchedText = text.substring(startIdx, endIdx);
					matches.push({
						start: startIdx,
						end: endIdx,
						text: matchedText,
						line: currentLine
					});

					// Update currentLine if we skipped over any newlines in the matched console.log content
					for (let k = 0; k < matchedText.length; k++) {
						if (matchedText[k] === '\n') {
							currentLine++;
						}
					}

					i = endIdx;
					continue;
				}
			}
		}

		i++;
	}

	return matches;
}

export function activate(context: vscode.ExtensionContext) {
	console.log("LogSweeper is active!");

	const disposable = vscode.commands.registerCommand(
		"logsweeper.cleanConsole",
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage("Koi file open nahi hai!");
				return;
			}

			const document = editor.document;
			const text = document.getText();
			const edits = findConsoleLogs(text);

			if (edits.length === 0) {
				vscode.window.showInformationMessage("Koi naya console.log nahi mila.");
				return;
			}

			const success = await editor.edit((editBuilder) => {
				edits.forEach((item) => {
					const startPos = document.positionAt(item.start);
					const endPos = document.positionAt(item.end);
					const range = new vscode.Range(startPos, endPos);
					editBuilder.replace(range, `/* ${item.text} */`);
				});
			});

			if (success) {
				// Clear output panel and write new report details
				outputChannel.clear();
				outputChannel.appendLine("🧹 LogSweeper Report:\n====================");
				outputChannel.appendLine(
					`${edits.length} console.log statement(s) found and commented out:\n`
				);

				edits.forEach((item, index) => {
					outputChannel.appendLine(`--> Console ${index + 1} found at Line: ${item.line}`);
				});

				// Automatically show the Output panel
				outputChannel.show(true);

				vscode.window.showInformationMessage(
					`🎉 ${edits.length} console.log statement(s) commented out! Details in the Output panel.`
				);
			} else {
				vscode.window.showErrorMessage("Failed to comment out console logs.");
			}
		}
	);

	context.subscriptions.push(disposable);
}

export function deactivate() {}
