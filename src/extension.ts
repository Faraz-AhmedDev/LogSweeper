import * as vscode from 'vscode';
import { runSweeper, getSettings } from './orchestrator';
import { registerPreviewProvider } from './preview';
import { restoreBackupCommand } from './backup';

export function activate(context: vscode.ExtensionContext) {
	console.log('LogSweeper is active!');

	// Register preview virtual text document provider
	registerPreviewProvider(context);

	// Helper wrapper to run sweeps
	const registerSweep = (commandId: string, action: 'comment' | 'uncomment' | 'toggle' | 'delete' | 'preview', target: 'active' | 'folder' | 'workspace') => {
		const disposable = vscode.commands.registerCommand(commandId, async (uri?: vscode.Uri) => {
			try {
				await runSweeper(action, target, uri);
			} catch (err) {
				vscode.window.showErrorMessage(`LogSweeper encountered an error: ${err}`);
			}
		});
		context.subscriptions.push(disposable);
	};

	// 1. Existing cleanConsole command (maps to comment on active file)
	registerSweep('logsweeper.cleanConsole', 'comment', 'active');

	// 2. Comment logs in active file
	registerSweep('logsweeper.comment', 'comment', 'active');

	// 3. Uncomment logs in active file
	registerSweep('logsweeper.uncomment', 'uncomment', 'active');

	// 4. Toggle logs in active file
	registerSweep('logsweeper.toggle', 'toggle', 'active');

	// 5. Delete logs in active file
	registerSweep('logsweeper.delete', 'delete', 'active');

	// 6. Scan Active File (Comment/Uncomment preview)
	registerSweep('logsweeper.scanActive', 'preview', 'active');

	// 7. Scan Selected Folder (Context menu & Command Palette)
	registerSweep('logsweeper.scanFolder', 'preview', 'folder');

	// 8. Scan Entire Workspace (Context menu & Command Palette)
	registerSweep('logsweeper.scanWorkspace', 'preview', 'workspace');

	// 9. Preview Changes (Active file diff preview)
	registerSweep('logsweeper.preview', 'preview', 'active');

	// 10. Restore Backup
	const restoreBackupDisposable = vscode.commands.registerCommand('logsweeper.restoreBackup', async () => {
		try {
			const settings = getSettings();
			await restoreBackupCommand(settings);
		} catch (err) {
			vscode.window.showErrorMessage(`LogSweeper backup restore failed: ${err}`);
		}
	});
	context.subscriptions.push(restoreBackupDisposable);
}

export function deactivate() {}
