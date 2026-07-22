import * as vscode from 'vscode';
import * as path from 'path';
import { BackupManifestEntry, LogSweeperSettings } from './types';

/**
 * Gets the absolute URI of the backup directory inside the workspace.
 */
export function getBackupDirUri(settings: LogSweeperSettings): vscode.Uri | undefined {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		return undefined;
	}
	const folderName = settings.backupFolder || '.logsweeper-backups';
	return vscode.Uri.joinPath(workspaceFolder.uri, folderName);
}

/**
 * Reads the backup manifest JSON file. Returns an empty array if the manifest doesn't exist.
 */
export async function readManifest(backupDirUri: vscode.Uri): Promise<BackupManifestEntry[]> {
	const manifestUri = vscode.Uri.joinPath(backupDirUri, 'backups.json');
	try {
		const bytes = await vscode.workspace.fs.readFile(manifestUri);
		const decoder = new TextDecoder('utf-8');
		const content = decoder.decode(bytes);
		return JSON.parse(content) as BackupManifestEntry[];
	} catch {
		return [];
	}
}

/**
 * Writes the backup manifest JSON file to disk.
 */
export async function writeManifest(backupDirUri: vscode.Uri, entries: BackupManifestEntry[]): Promise<void> {
	const manifestUri = vscode.Uri.joinPath(backupDirUri, 'backups.json');
	const encoder = new TextEncoder();
	const bytes = encoder.encode(JSON.stringify(entries, null, 2));
	await vscode.workspace.fs.writeFile(manifestUri, bytes);
}

/**
 * Creates a backup of a file's original content before modifications are made.
 */
export async function createBackup(
	fileUri: vscode.Uri,
	originalContent: string,
	settings: LogSweeperSettings
): Promise<void> {
	if (!settings.backupEnabled) {
		return;
	}

	const backupDirUri = getBackupDirUri(settings);
	if (!backupDirUri) {
		return;
	}

	// Ensure the backup directory exists
	try {
		await vscode.workspace.fs.createDirectory(backupDirUri);
	} catch (err) {
		console.error(`Failed to create backup directory: ${err}`);
		return;
	}

	const entries = await readManifest(backupDirUri);

	const id = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
	const backupFilename = `${id}.bak`;
	const backupUri = vscode.Uri.joinPath(backupDirUri, backupFilename);

	// Write the backup file contents
	const encoder = new TextEncoder();
	const bytes = encoder.encode(originalContent);
	await vscode.workspace.fs.writeFile(backupUri, bytes);

	// Add entry to manifest
	const newEntry: BackupManifestEntry = {
		id,
		backupPath: backupUri.toString(),
		originalPath: fileUri.toString(),
		timestamp: new Date().toISOString(),
		filename: path.basename(fileUri.fsPath)
	};
	entries.push(newEntry);

	// Save and trigger cleanup
	await writeManifest(backupDirUri, entries);
	await cleanOldBackups(settings);
}

/**
 * Automatically cleans up backups based on maximum count and age settings.
 */
export async function cleanOldBackups(settings: LogSweeperSettings): Promise<void> {
	if (!settings.autoCleanupBackups) {
		return;
	}

	const backupDirUri = getBackupDirUri(settings);
	if (!backupDirUri) {
		return;
	}

	let entries = await readManifest(backupDirUri);
	if (entries.length === 0) {
		return;
	}

	const cleanedEntries: BackupManifestEntry[] = [];
	const now = Date.now();
	const maxAgeMs = settings.backupMaxAgeDays * 24 * 60 * 60 * 1000;

	// Sort manifest by timestamp (oldest first) to enforce limits
	entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

	for (let idx = 0; idx < entries.length; idx++) {
		const entry = entries[idx];
		const ageMs = now - new Date(entry.timestamp).getTime();

		// 1. Delete if older than maxAgeDays
		const isTooOld = ageMs > maxAgeMs;

		// 2. Delete if exceeding maximum count limit (keep the newest ones)
		const isExceedingLimit = entries.length - idx > settings.backupLimit;

		if (isTooOld || isExceedingLimit) {
			try {
				const backupFileUri = vscode.Uri.parse(entry.backupPath);
				await vscode.workspace.fs.delete(backupFileUri);
			} catch (err) {
				console.error(`Failed to delete old backup file ${entry.backupPath}: ${err}`);
			}
		} else {
			cleanedEntries.push(entry);
		}
	}

	await writeManifest(backupDirUri, cleanedEntries);
}

/**
 * Displays a list of backups and restores the selected one.
 */
export async function restoreBackupCommand(settings: LogSweeperSettings): Promise<void> {
	const backupDirUri = getBackupDirUri(settings);
	if (!backupDirUri) {
		vscode.window.showErrorMessage('Backup is not supported outside of a workspace.');
		return;
	}

	const entries = await readManifest(backupDirUri);
	if (entries.length === 0) {
		vscode.window.showInformationMessage('No active backups found in this workspace.');
		return;
	}

	// Sort backups (newest first) for user presentation
	entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	const quickPickItems = entries.map(entry => {
		const originalUri = vscode.Uri.parse(entry.originalPath);
		let relPath = originalUri.fsPath;
		if (workspaceFolder) {
			relPath = path.relative(workspaceFolder.uri.fsPath, originalUri.fsPath);
		}

		return {
			label: `$(history) ${entry.filename}`,
			description: new Date(entry.timestamp).toLocaleString(),
			detail: relPath,
			entry
		};
	});

	const selection = await vscode.window.showQuickPick(quickPickItems, {
		placeHolder: 'Select a backup to restore',
		title: 'LogSweeper: Restore Backup'
	});

	if (!selection) {
		return;
	}

	const selectedEntry = selection.entry;
	const originalFileUri = vscode.Uri.parse(selectedEntry.originalPath);
	const backupFileUri = vscode.Uri.parse(selectedEntry.backupPath);

	try {
		// Read content from backup file
		const backupBytes = await vscode.workspace.fs.readFile(backupFileUri);

		// Write content back to original file path
		await vscode.workspace.fs.writeFile(originalFileUri, backupBytes);

		// Remove the restored backup from manifest and delete backup file
		const updatedEntries = entries.filter(e => e.id !== selectedEntry.id);
		await writeManifest(backupDirUri, updatedEntries);

		try {
			await vscode.workspace.fs.delete(backupFileUri);
		} catch (err) {
			console.error(`Failed to delete backup file after restore: ${err}`);
		}

		vscode.window.showInformationMessage(`🎉 Successfully restored ${selectedEntry.filename} from backup.`);
	} catch (err) {
		vscode.window.showErrorMessage(`Failed to restore backup: ${err}`);
	}
}
