import * as vscode from 'vscode';

export interface LogMatch {
	start: number;
	end: number;
	text: string;
	line: number;
	type: 'commented' | 'uncommented';
	commentStyle?: 'line' | 'block';
	uncommentedText?: string;
}

export interface LogSweeperSettings {
	commentMode: 'block' | 'line';
	backupEnabled: boolean;
	autoCleanupBackups: boolean;
	backupFolder: string;
	backupLimit: number;
	backupMaxAgeDays: number;
	includeConsoleWarn: boolean;
	includeConsoleError: boolean;
	includeConsoleDebug: boolean;
	includeConsoleInfo: boolean;
	includeConsoleTrace: boolean;
	includeDebuggerStatements: boolean;
	workspaceExclusions: string[];
	ignorePatterns: string[];
	previewBeforeApplying: boolean;
}

export interface FileModification {
	uri: vscode.Uri;
	originalContent: string;
	modifiedContent: string;
	matches: LogMatch[];
}

export interface BackupManifestEntry {
	id: string;
	backupPath: string;
	originalPath: string;
	timestamp: string;
	filename: string;
}

export interface ScanResult {
	filesScanned: number;
	filesModified: number;
	totalLogsFound: number;
	logsCommented: number;
	logsUncommented: number;
	logsDeleted: number;
	timeTakenMs: number;
}
