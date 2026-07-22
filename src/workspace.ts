import * as vscode from 'vscode';
import * as path from 'path';
import { LANGUAGE_CONFIGS } from './languages';

/**
 * Gathers a set of all supported file extensions from the configurations.
 */
export function getSupportedExtensions(): Set<string> {
	const exts = new Set<string>();
	for (const config of LANGUAGE_CONFIGS) {
		for (const ext of config.extensions) {
			exts.add(ext);
		}
	}
	return exts;
}

/**
 * Builds a Glob pattern for exclusions.
 */
export function buildExcludeGlob(exclusions: string[]): string {
	const cleanExclusions = exclusions
		.map(e => e.replace(/^[\/*!\.\/]+/, '').replace(/[\/*!\.\/]+$/, ''))
		.filter(Boolean);

	if (cleanExclusions.length === 0) {
		return '';
	}
	return `**/{${cleanExclusions.join(',')}}/**`;
}

/**
 * Finds all supported code files in the workspace using VS Code's index-level search.
 */
export async function getWorkspaceFiles(
	exclusions: string[],
	token?: vscode.CancellationToken
): Promise<vscode.Uri[]> {
	const extensions = getSupportedExtensions();
	const extArray = Array.from(extensions).map(e => e.replace('.', ''));
	const includePattern = `**/*.{${extArray.join(',')}}`;
	const excludePattern = buildExcludeGlob(exclusions);

	return await vscode.workspace.findFiles(includePattern, excludePattern, undefined, token);
}

/**
 * Recursively walks a folder and returns all supported files, respecting exclusions and cancellation.
 */
export async function getFolderFiles(
	folderUri: vscode.Uri,
	exclusions: string[],
	token?: vscode.CancellationToken
): Promise<vscode.Uri[]> {
	const extensions = getSupportedExtensions();
	const cleanExclusions = exclusions
		.map(e => e.replace(/^[\/*!\.\/]+/, '').replace(/[\/*!\.\/]+$/, ''))
		.filter(Boolean);

	const results: vscode.Uri[] = [];

	async function walk(currentUri: vscode.Uri) {
		if (token?.isCancellationRequested) {
			return;
		}

		try {
			const entries = await vscode.workspace.fs.readDirectory(currentUri);
			for (const [name, type] of entries) {
				if (token?.isCancellationRequested) {
					return;
				}

				if (type === vscode.FileType.Directory) {
					const isExcluded = cleanExclusions.some(exclude => {
						return name.toLowerCase() === exclude.toLowerCase();
					});
					if (isExcluded) {
						continue;
					}
					const subUri = vscode.Uri.joinPath(currentUri, name);
					await walk(subUri);
				} else if (type === vscode.FileType.File) {
					const ext = path.extname(name).toLowerCase();
					if (extensions.has(ext)) {
						results.push(vscode.Uri.joinPath(currentUri, name));
					}
				}
			}
		} catch (err) {
			console.error(`Error reading directory ${currentUri.fsPath}: ${err}`);
		}
	}

	await walk(folderUri);
	return results;
}
