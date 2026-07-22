import * as vscode from 'vscode';
import * as path from 'path';
import { FileModification } from './types';

/**
 * Providers the modified document content for the side-by-side diff editor view.
 */
class LogSweeperPreviewProvider implements vscode.TextDocumentContentProvider {
	private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	readonly onDidChange = this._onDidChange.event;
	private documents = new Map<string, string>(); // uriString -> content

	provideTextDocumentContent(uri: vscode.Uri): string {
		return this.documents.get(uri.toString()) || '';
	}

	setDocumentContent(uri: vscode.Uri, content: string) {
		this.documents.set(uri.toString(), content);
		this._onDidChange.fire(uri);
	}
}

export const previewProvider = new LogSweeperPreviewProvider();

/**
 * Registers the virtual text document provider with VS Code.
 */
export function registerPreviewProvider(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider('logsweeper-preview', previewProvider)
	);
}

/**
 * Shows an interactive preview list of files to change.
 * Allows the user to select/deselect files (Apply/Skip), preview diffs, or cancel.
 */
export async function showPreview(
	modifications: FileModification[]
): Promise<FileModification[] | undefined> {
	if (modifications.length === 0) {
		vscode.window.showInformationMessage('No log statements found matching configuration.');
		return undefined;
	}

	const totalLogs = modifications.reduce((sum, m) => sum + m.matches.length, 0);

	const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { modification: FileModification }>();
	quickPick.title = `LogSweeper Preview: ${totalLogs} logs in ${modifications.length} files`;
	quickPick.placeholder = 'Deselect files to skip. Press Enter/OK to Apply. Escape to Cancel.';
	quickPick.canSelectMany = true;
	quickPick.ignoreFocusOut = true;

	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	const items = modifications.map(m => {
		const relativePath = workspaceFolder
			? path.relative(workspaceFolder.uri.fsPath, m.uri.fsPath)
			: m.uri.fsPath;

		const lineNumbers = m.matches.map(match => match.line).slice(0, 10).join(', ');
		const extraLines = m.matches.length > 10 ? '...' : '';
		const lineSummary = `Lines: ${lineNumbers}${extraLines}`;

		return {
			label: relativePath,
			description: `$(bug) ${m.matches.length} logs found`,
			detail: lineSummary,
			buttons: [
				{
					iconPath: new vscode.ThemeIcon('git-compare'),
					tooltip: 'Preview Diff Changes'
				}
			],
			modification: m
		};
	});

	quickPick.items = items;
	quickPick.selectedItems = items; // all selected by default

	// Setup item button click listener for triggering diff preview
	const buttonDisposable = quickPick.onDidTriggerItemButton(async (e) => {
		const mod = e.item.modification;
		const originalUri = mod.uri;
		// Encode the original URI inside the virtual URI query string
		const previewUri = vscode.Uri.parse(
			`logsweeper-preview://preview/${encodeURIComponent(originalUri.fsPath)}?${encodeURIComponent(originalUri.toString())}`
		);

		previewProvider.setDocumentContent(previewUri, mod.modifiedContent);

		await vscode.commands.executeCommand(
			'vscode.diff',
			originalUri,
			previewUri,
			`LogSweeper Preview: ${path.basename(originalUri.fsPath)}`
		);
	});

	quickPick.show();

	const result = await new Promise<FileModification[] | undefined>((resolve) => {
		quickPick.onDidAccept(() => {
			const selected = quickPick.selectedItems.map(item => item.modification);
			resolve(selected);
			quickPick.hide();
		});

		quickPick.onDidHide(() => {
			resolve(undefined);
		});
	});

	buttonDisposable.dispose();
	quickPick.dispose();

	return result;
}
