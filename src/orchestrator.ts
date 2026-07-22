import * as vscode from 'vscode';
import * as path from 'path';
import { LogMatch, LogSweeperSettings, FileModification, ScanResult } from './types';
import { getLanguageConfig, getLanguageConfigByLanguageId } from './languages';
import { scanFile } from './scanner';
import { createBackup } from './backup';
import { showPreview } from './preview';
import { getWorkspaceFiles, getFolderFiles } from './workspace';

// Create a new Output Channel which will show up in the VS Code bottom panel
export const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('LogSweeper');

/**
 * Loads current settings from VS Code configurations.
 */
export function getSettings(): LogSweeperSettings {
	const config = vscode.workspace.getConfiguration('logsweeper');
	return {
		commentMode: config.get<'block' | 'line'>('commentMode', 'block'),
		backupEnabled: config.get<boolean>('backupEnabled', true),
		autoCleanupBackups: config.get<boolean>('autoCleanupBackups', true),
		backupFolder: config.get<string>('backupFolder', '.logsweeper-backups'),
		backupLimit: config.get<number>('backupLimit', 50),
		backupMaxAgeDays: config.get<number>('backupMaxAgeDays', 7),
		includeConsoleWarn: config.get<boolean>('includeConsoleWarn', true),
		includeConsoleError: config.get<boolean>('includeConsoleError', true),
		includeConsoleDebug: config.get<boolean>('includeConsoleDebug', true),
		includeConsoleInfo: config.get<boolean>('includeConsoleInfo', true),
		includeConsoleTrace: config.get<boolean>('includeConsoleTrace', true),
		includeDebuggerStatements: config.get<boolean>('includeDebuggerStatements', true),
		workspaceExclusions: config.get<string[]>('workspaceExclusions', [
			'node_modules',
			'.git',
			'dist',
			'build',
			'coverage',
			'.next',
			'ios/build',
			'android/build'
		]),
		ignorePatterns: config.get<string[]>('ignorePatterns', []),
		previewBeforeApplying: config.get<boolean>('previewBeforeApplying', true)
	};
}

/**
 * Reads the content of a file, using open TextDocument content if available.
 */
async function getFileContent(uri: vscode.Uri): Promise<string> {
	const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
	if (openDoc) {
		return openDoc.getText();
	}
	const bytes = await vscode.workspace.fs.readFile(uri);
	return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Sorts and applies text replacements in reverse order of start offset.
 */
function applyReplacements(
	text: string,
	replacements: { start: number; end: number; replacement: string }[]
): string {
	replacements.sort((a, b) => b.start - a.start);
	let result = text;
	for (const r of replacements) {
		result = result.substring(0, r.start) + r.replacement + result.substring(r.end);
	}
	return result;
}

/**
 * Runs the LogSweeper command logic.
 */
export async function runSweeper(
	action: 'comment' | 'uncomment' | 'toggle' | 'delete' | 'preview',
	target: 'active' | 'folder' | 'workspace',
	targetUri?: vscode.Uri
): Promise<void> {
	outputChannel.show(true);
	outputChannel.clear();
	outputChannel.appendLine(`[LOG] Starting sweep. Action: "${action}", Target: "${target}"`);

	const settings = getSettings();
	const startTime = Date.now();

	// 1. Resolve files to process
	let files: vscode.Uri[] = [];

	if (target === 'active') {
		const activeUri = targetUri || vscode.window.activeTextEditor?.document.uri;
		if (!activeUri) {
			vscode.window.showErrorMessage('No active file is open!');
			return;
		}
		files = [activeUri];
	} else if (target === 'folder') {
		let folderUri = targetUri;
		if (!folderUri) {
			const selected = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				title: 'LogSweeper: Select Folder to Scan'
			});
			if (!selected || selected.length === 0) {
				return;
			}
			folderUri = selected[0];
		}
		files = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'LogSweeper: Scanning folder...',
				cancellable: true
			},
			async (progress, token) => {
				return await getFolderFiles(folderUri!, settings.workspaceExclusions, token);
			}
		);
	} else if (target === 'workspace') {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders || folders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder is open!');
			return;
		}
		files = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'LogSweeper: Scanning workspace...',
				cancellable: true
			},
			async (progress, token) => {
				return await getWorkspaceFiles(settings.workspaceExclusions, token);
			}
		);
	}

	if (files.length === 0) {
		outputChannel.appendLine('[LOG] No supported files found.');
		vscode.window.showInformationMessage('No supported source files found to scan.');
		return;
	}

	outputChannel.appendLine(`[LOG] Resolved ${files.length} file(s) to scan.`);

	// 2. Scan each file and compute modifications
	const modifications: FileModification[] = [];
	let totalLogsFound = 0;
	let filesScanned = 0;

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: 'LogSweeper: Parsing files...',
			cancellable: true
		},
		async (progress, token) => {
			for (let idx = 0; idx < files.length; idx++) {
				if (token.isCancellationRequested) {
					break;
				}

				const fileUri = files[idx];
				filesScanned++;

				progress.report({
					message: `Parsing ${path.basename(fileUri.fsPath)} (${idx + 1}/${files.length})`,
					increment: (1 / files.length) * 100
				});

				// Determine language configuration
				let config = getLanguageConfig(fileUri.fsPath);
				if (!config) {
					// Fallback to active editor language ID if this is the active file
					const activeEditor = vscode.window.activeTextEditor;
					if (activeEditor && activeEditor.document.uri.toString() === fileUri.toString()) {
						config = getLanguageConfigByLanguageId(activeEditor.document.languageId);
					}
				}

				if (!config) {
					outputChannel.appendLine(`[LOG] Skipping file (unsupported language): ${fileUri.fsPath}`);
					continue;
				}

				outputChannel.appendLine(`[LOG] Scanning file: ${fileUri.fsPath}`);
				try {
					const content = await getFileContent(fileUri);
					const fileMatches = scanFile(content, config, settings);
					outputChannel.appendLine(`[LOG] Found ${fileMatches.length} raw matches in ${path.basename(fileUri.fsPath)}.`);
					if (fileMatches.length === 0) {
						continue;
					}

					totalLogsFound += fileMatches.length;

					// Filter matches based on the requested action
					let targetMatches: LogMatch[] = [];
					if (action === 'comment') {
						targetMatches = fileMatches.filter(m => m.type === 'uncommented');
					} else if (action === 'uncomment') {
						targetMatches = fileMatches.filter(m => m.type === 'commented');
					} else if (action === 'toggle' || action === 'delete' || action === 'preview') {
						targetMatches = fileMatches;
					}

					outputChannel.appendLine(`[LOG] Target matches (filtered by action "${action}"): ${targetMatches.length}.`);
					if (targetMatches.length === 0) {
						continue;
					}

					// Compute replacements
					const replacements: { start: number; end: number; replacement: string }[] = [];
					const lineCommentStart = Array.isArray(config.lineCommentStart)
						? config.lineCommentStart[0]
						: config.lineCommentStart;

					for (const match of targetMatches) {
						let repText = '';
						let repStart = match.start;
						let repEnd = match.end;

						// Determine replacement text
						let act: 'comment' | 'uncomment' | 'delete' = 'comment';
						if (action === 'comment') {
							act = 'comment';
						} else if (action === 'uncomment') {
							act = 'uncomment';
						} else if (action === 'delete') {
							act = 'delete';
						} else {
							// toggle or preview defaults
							act = match.type === 'uncommented' ? 'comment' : 'uncomment';
						}

						if (act === 'comment') {
							if (settings.commentMode === 'block' && config.blockCommentStart && config.blockCommentEnd) {
								repText = `${config.blockCommentStart} ${match.text} ${config.blockCommentEnd}`;
							} else {
								repText = match.text
									.split(/\r?\n/)
									.map(line => `${lineCommentStart} ${line}`)
									.join('\n');
							}
						} else if (act === 'uncomment') {
							repText = match.uncommentedText || '';
						} else if (act === 'delete') {
							repText = '';

							// Delete the entire line if it only contains the log statement
							let lineStartIdx = match.start;
							while (lineStartIdx > 0 && content[lineStartIdx - 1] !== '\n' && content[lineStartIdx - 1] !== '\r') {
								lineStartIdx--;
							}
							const prefix = content.substring(lineStartIdx, match.start);

							let lineEndIdx = match.end;
							while (lineEndIdx < content.length && content[lineEndIdx] !== '\n' && content[lineEndIdx] !== '\r') {
								lineEndIdx++;
							}
							const suffix = content.substring(match.end, lineEndIdx);

							if (/^\s*$/.test(prefix) && /^\s*;?\s*$/.test(suffix)) {
								repStart = lineStartIdx;
								if (content[lineEndIdx] === '\r' && content[lineEndIdx + 1] === '\n') {
									repEnd = lineEndIdx + 2;
								} else if (content[lineEndIdx] === '\n') {
									repEnd = lineEndIdx + 1;
								} else {
									repEnd = lineEndIdx;
								}
							}
						}

						replacements.push({
							start: repStart,
							end: repEnd,
							replacement: repText
						});
					}

					const modifiedContent = applyReplacements(content, replacements);

					modifications.push({
						uri: fileUri,
						originalContent: content,
						modifiedContent,
						matches: targetMatches
					});
				} catch (err) {
					vscode.window.showErrorMessage(`Error reading file ${fileUri.fsPath}: ${err}`);
				}
			}
		}
	);

	outputChannel.appendLine(`[LOG] Scanning finished. Files with modifications: ${modifications.length}.`);
	if (modifications.length === 0) {
		outputChannel.appendLine('[LOG] No modifications to apply.');
		vscode.window.showInformationMessage('No changes needed. All files are clean.');
		return;
	}

	// 3. Handle preview flow if configured
	let finalModifications = modifications;
	if (action === 'preview' || settings.previewBeforeApplying) {
		outputChannel.appendLine('[LOG] Showing interactive preview...');
		const previewResult = await showPreview(modifications);
		if (!previewResult) {
			outputChannel.appendLine('[LOG] Preview cancelled or closed by user.');
			return;
		}
		finalModifications = previewResult;
		outputChannel.appendLine(`[LOG] Preview accepted. Files selected to modify: ${finalModifications.length}.`);
	}

	if (finalModifications.length === 0) {
		outputChannel.appendLine('[LOG] No files selected to modify.');
		return;
	}

	// 4. Confirmation dialog for deletion
	const isDelete = action === 'delete' || (action === 'toggle' && finalModifications.some(m => m.matches.some(match => match.type === 'commented')));
	// Wait, toggle doesn't delete, only "delete" action deletes. Let's ask confirmation for deletes
	if (action === 'delete') {
		const totalDeleteLogs = finalModifications.reduce((sum, m) => sum + m.matches.length, 0);
		const confirm = await vscode.window.showWarningMessage(
			`Are you sure you want to permanently delete ${totalDeleteLogs} debug log(s) across ${finalModifications.length} file(s)?`,
			{ modal: true },
			'Delete Logs'
		);
		if (confirm !== 'Delete Logs') {
			return;
		}
	}

	// 5. Create backups before making edits
	if (settings.backupEnabled) {
		for (const mod of finalModifications) {
			await createBackup(mod.uri, mod.originalContent, settings);
		}
	}

	// 6. Apply Workspace Edits
	outputChannel.appendLine(`[LOG] Applying workspace edits to ${finalModifications.length} files...`);
	const workspaceEdit = new vscode.WorkspaceEdit();
	for (const mod of finalModifications) {
		const fullRange = new vscode.Range(
			new vscode.Position(0, 0),
			new vscode.Position(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
		);
		workspaceEdit.replace(mod.uri, fullRange, mod.modifiedContent);
	}

	const success = await vscode.workspace.applyEdit(workspaceEdit);
	const timeTakenMs = Date.now() - startTime;

	outputChannel.appendLine(`[LOG] Workspace applyEdit result: ${success ? 'SUCCESS' : 'FAILURE'}`);
	if (success) {
		// Calculate stats
		let logsCommented = 0;
		let logsUncommented = 0;
		let logsDeleted = 0;

		finalModifications.forEach(m => {
			m.matches.forEach(match => {
				if (action === 'comment') {
					logsCommented++;
				} else if (action === 'uncomment') {
					logsUncommented++;
				} else if (action === 'delete') {
					logsDeleted++;
				} else if (action === 'toggle') {
					if (match.type === 'uncommented') {
						logsCommented++;
					} else {
						logsUncommented++;
					}
				}
			});
		});

		const stats: ScanResult = {
			filesScanned,
			filesModified: finalModifications.length,
			totalLogsFound,
			logsCommented,
			logsUncommented,
			logsDeleted,
			timeTakenMs
		};

		printReport(stats, finalModifications, action);
	} else {
		vscode.window.showErrorMessage('LogSweeper: Failed to apply modifications.');
	}
}

/**
 * Prints execution statistics to the LogSweeper output channel and displays info message.
 */
function printReport(stats: ScanResult, modifications: FileModification[], action: string) {
	outputChannel.clear();
	outputChannel.appendLine('🧹 LogSweeper Execution Report:');
	outputChannel.appendLine('========================================');
	outputChannel.appendLine(`Files Scanned:       ${stats.filesScanned}`);
	outputChannel.appendLine(`Files Modified:      ${stats.filesModified}`);
	outputChannel.appendLine(`Total Logs Found:    ${stats.totalLogsFound}`);
	outputChannel.appendLine(`Logs Commented:      ${stats.logsCommented}`);
	outputChannel.appendLine(`Logs Uncommented:    ${stats.logsUncommented}`);
	outputChannel.appendLine(`Logs Deleted:        ${stats.logsDeleted}`);
	outputChannel.appendLine(`Time Taken:          ${(stats.timeTakenMs / 1000).toFixed(2)}s`);
	outputChannel.appendLine('========================================\n');

	outputChannel.appendLine('Modified Files Details:');
	modifications.forEach((mod, idx) => {
		outputChannel.appendLine(`\nFile [${idx + 1}]: ${mod.uri.fsPath}`);
		mod.matches.forEach(match => {
			outputChannel.appendLine(`  --> Line ${match.line}: [${match.type}] ${match.text.trim().substring(0, 80)}`);
		});
	});

	outputChannel.show(true);

	let summaryMessage = `LogSweeper: Processed ${stats.filesModified} file(s) in ${(stats.timeTakenMs / 1000).toFixed(2)}s. `;
	if (stats.logsCommented > 0) { summaryMessage += `Commented: ${stats.logsCommented}. `; }
	if (stats.logsUncommented > 0) { summaryMessage += `Uncommented: ${stats.logsUncommented}. `; }
	if (stats.logsDeleted > 0) { summaryMessage += `Deleted: ${stats.logsDeleted}. `; }

	vscode.window.showInformationMessage(`🎉 ${summaryMessage}See details in the Output panel.`);
}
