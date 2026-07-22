import { LogMatch, LogSweeperSettings } from './types';
import { LanguageConfig } from './languages';

/**
 * Checks if a specific log type is enabled in the configuration settings.
 */
function isLogTypeEnabled(prefix: string, settings: LogSweeperSettings): boolean {
	if (prefix === 'console.warn' && !settings.includeConsoleWarn) { return false; }
	if (prefix === 'console.error' && !settings.includeConsoleError) { return false; }
	if (prefix === 'console.debug' && !settings.includeConsoleDebug) { return false; }
	if (prefix === 'console.info' && !settings.includeConsoleInfo) { return false; }
	if (prefix === 'console.trace' && !settings.includeConsoleTrace) { return false; }
	if (prefix === 'debugger' && !settings.includeDebuggerStatements) { return false; }
	return true;
}

/**
 * Verifies if the trimmed content of a comment is exactly a valid log statement.
 */
function checkIfContentIsLog(trimmed: string, config: LanguageConfig, settings: LogSweeperSettings): boolean {
	if (!trimmed) { return false; }

	let matchedPrefix = '';
	for (const prefix of config.logPrefixes) {
		if (!isLogTypeEnabled(prefix, settings)) {
			continue;
		}

		if (trimmed.startsWith(prefix)) {
			const nextChar = trimmed[prefix.length] || '';
			if (prefix === 'debugger') {
				if (!/\w/.test(nextChar)) {
					matchedPrefix = prefix;
					break;
				}
			} else {
				let checkIdx = prefix.length;
				while (checkIdx < trimmed.length && /\s/.test(trimmed[checkIdx])) {
					checkIdx++;
				}
				if (trimmed[checkIdx] === '(') {
					matchedPrefix = prefix;
					break;
				}
			}
		}
	}

	if (!matchedPrefix) { return false; }

	if (matchedPrefix === 'debugger') {
		const remaining = trimmed.substring(matchedPrefix.length).trim();
		return remaining === '' || remaining === ';';
	}

	const openParenIdx = trimmed.indexOf('(', matchedPrefix.length);
	if (openParenIdx === -1) { return false; }

	let parenCount = 1;
	let idx = openParenIdx + 1;
	let inString: string | null = null;
	const stringDelimiters = config.stringDelimiters || ["'", '"', '`'];

	while (idx < trimmed.length && parenCount > 0) {
		const char = trimmed[idx];

		if (inString) {
			if (char === '\\') {
				idx += 2;
				continue;
			}
			if (trimmed.startsWith(inString, idx)) {
				idx += inString.length;
				inString = null;
				continue;
			}
			idx++;
			continue;
		}

		let startedString = false;
		for (const delim of stringDelimiters) {
			if (trimmed.startsWith(delim, idx)) {
				inString = delim;
				idx += delim.length;
				startedString = true;
				break;
			}
		}
		if (startedString) {
			continue;
		}

		if (char === '(') {
			parenCount++;
		} else if (char === ')') {
			parenCount--;
		}
		idx++;
	}

	if (parenCount !== 0) { return false; }

	const remaining = trimmed.substring(idx).trim();
	return remaining === '' || remaining === ';';
}

/**
 * Scans file text and returns all matches.
 */
export function scanFile(text: string, config: LanguageConfig, settings: LogSweeperSettings): LogMatch[] {
	const matches: LogMatch[] = [];
	const lines = text.split(/\r?\n/);

	// 1. Gather all line numbers containing ignore comment
	const ignoredLines = new Set<number>();
	const standaloneIgnoredLines = new Set<number>();

	const lineCommentStarts = typeof config.lineCommentStart === 'string'
		? [config.lineCommentStart]
		: config.lineCommentStart;

	const blockCommentPairs: { start: string; end: string }[] = [];
	if (config.blockCommentStart && config.blockCommentEnd) {
		blockCommentPairs.push({ start: config.blockCommentStart, end: config.blockCommentEnd });
	}
	if (config.name === 'vue') {
		blockCommentPairs.push({ start: '<!--', end: '-->' });
	}
	if (config.name === 'python') {
		blockCommentPairs.push({ start: '"""', end: '"""' });
		blockCommentPairs.push({ start: "'''", end: "'''" });
	}

	for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
		const line = lines[lineIdx];
		if (line.includes('logsweeper-ignore')) {
			ignoredLines.add(lineIdx + 1);

			// Check if it is a standalone comment (preceded only by whitespace)
			const trimmed = line.trim();
			let isStandalone = false;
			for (const startStr of lineCommentStarts) {
				if (trimmed.startsWith(startStr)) {
					isStandalone = true;
					break;
				}
			}
			if (!isStandalone) {
				for (const pair of blockCommentPairs) {
					if (trimmed.startsWith(pair.start)) {
						isStandalone = true;
						break;
					}
				}
			}
			if (isStandalone) {
				standaloneIgnoredLines.add(lineIdx + 1);
			}
		}
	}

	const isLineIgnored = (line: number): boolean => {
		if (ignoredLines.has(line)) { return true; }
		if (standaloneIgnoredLines.has(line - 1)) { return true; }

		// Go upwards skipping blank lines to check if the first non-blank line has a standalone ignore comment
		let prevLine = line - 1;
		while (prevLine > 0 && lines[prevLine - 1].trim() === '') {
			prevLine--;
		}
		if (prevLine > 0 && standaloneIgnoredLines.has(prevLine)) {
			return true;
		}
		return false;
	};

	// 2. Scan text character by character
	let i = 0;
	let currentLine = 1;
	let inString: string | null = null;
	let inComment: { type: 'line' | 'block'; start: number } | null = null;

	const stringDelimiters = config.stringDelimiters || ["'", '"', '`'];

	while (i < text.length) {
		const char = text[i];

		if (char === '\n') {
			currentLine++;
		}

		// --- Inside Comment ---
		if (inComment) {
			if (inComment.type === 'line' && char === '\n') {
				const commentText = text.substring(inComment.start, i);
				processComment(commentText, inComment.start, i, currentLine - 1, 'line');
				inComment = null;
			} else if (inComment.type === 'block') {
				let matchedEnd = false;
				for (const pair of blockCommentPairs) {
					if (text.startsWith(pair.end, i)) {
						const endIdx = i + pair.end.length;
						const commentText = text.substring(inComment.start, endIdx);
						processComment(commentText, inComment.start, endIdx, currentLine, 'block');
						inComment = null;
						i = endIdx;
						matchedEnd = true;
						break;
					}
				}
				if (matchedEnd) {
					// Don't increment currentLine multiple times if there are newlines inside this block comment end check
					continue;
				}
			}
			i++;
			continue;
		}

		// --- Inside String ---
		if (inString) {
			if (char === '\\') {
				// Escape character, skip next char completely
				const nextChar = text[i + 1] || '';
				if (nextChar === '\n') {
					currentLine++;
				}
				i += 2;
				continue;
			}
			if (text.startsWith(inString, i)) {
				i += inString.length;
				inString = null;
				continue;
			}
			i++;
			continue;
		}

		// --- Comment Start Checks ---
		let startedComment = false;
		for (const startStr of lineCommentStarts) {
			if (text.startsWith(startStr, i)) {
				inComment = { type: 'line', start: i };
				i += startStr.length;
				startedComment = true;
				break;
			}
		}
		if (startedComment) {
			continue;
		}

		for (const pair of blockCommentPairs) {
			if (text.startsWith(pair.start, i)) {
				inComment = { type: 'block', start: i };
				i += pair.start.length;
				startedComment = true;
				break;
			}
		}
		if (startedComment) {
			continue;
		}

		// --- String Start Checks ---
		let startedString = false;
		for (const delim of stringDelimiters) {
			if (text.startsWith(delim, i)) {
				inString = delim;
				i += delim.length;
				startedString = true;
				break;
			}
		}
		if (startedString) {
			continue;
		}

		// --- Log Prefix Checks (Uncommented) ---
		let matchedLog = false;
		for (const prefix of config.logPrefixes) {
			if (!isLogTypeEnabled(prefix, settings)) {
				continue;
			}

			if (text.startsWith(prefix, i)) {
				// Word boundary check (before the prefix)
				const prevChar = i > 0 ? text[i - 1] : '';
				if (/\w/.test(prevChar)) {
					continue;
				}

				const afterPrefixIdx = i + prefix.length;

				// Special handling for debugger statement (does not require parenthesis)
				if (prefix === 'debugger') {
					const nextChar = text[afterPrefixIdx] || '';
					if (/\w/.test(nextChar)) {
						continue;
					}
					let endIdx = afterPrefixIdx;
					while (endIdx < text.length && /\s/.test(text[endIdx]) && text[endIdx] !== '\n') {
						endIdx++;
					}
					if (text[endIdx] === ';') {
						endIdx++;
					}

					if (!isLineIgnored(currentLine)) {
						matches.push({
							start: i,
							end: endIdx,
							text: text.substring(i, endIdx),
							line: currentLine,
							type: 'uncommented'
						});
					}
					i = endIdx;
					matchedLog = true;
					break;
				}

				// Standard prefix (requires function arguments in parenthesis)
				let checkIdx = afterPrefixIdx;
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
							if (text.startsWith(innerString, j)) {
								j += innerString.length;
								innerString = null;
								continue;
							}
							j++;
							continue;
						}

						let foundInnerString = false;
						for (const delim of stringDelimiters) {
							if (text.startsWith(delim, j)) {
								innerString = delim;
								j += delim.length;
								foundInnerString = true;
								break;
							}
						}
						if (foundInnerString) {
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
						// Consume trailing spaces (except newline) and trailing semicolon
						while (endIdx < text.length && /\s/.test(text[endIdx]) && text[endIdx] !== '\n') {
							endIdx++;
						}
						if (text[endIdx] === ';') {
							endIdx++;
						}

						const matchedText = text.substring(startIdx, endIdx);
						const logLine = currentLine;

						if (!isLineIgnored(logLine)) {
							matches.push({
								start: startIdx,
								end: endIdx,
								text: matchedText,
								line: logLine,
								type: 'uncommented'
							});
						}

						// Update lines counts if the matched statement spans multiple lines
						for (let k = 0; k < matchedText.length; k++) {
							if (matchedText[k] === '\n') {
								currentLine++;
							}
						}

						i = endIdx;
						matchedLog = true;
						break;
					}
				}
			}
		}

		if (matchedLog) {
			continue;
		}

		i++;
	}

	// Process comments at EOF
	if (inComment && inComment.type === 'line') {
		const commentText = text.substring(inComment.start);
		processComment(commentText, inComment.start, text.length, currentLine, 'line');
	}

	function processComment(
		commentText: string,
		start: number,
		end: number,
		line: number,
		commentStyle: 'line' | 'block'
	) {
		let inner = commentText;
		if (commentStyle === 'line') {
			for (const startStr of lineCommentStarts) {
				if (inner.startsWith(startStr)) {
					inner = inner.substring(startStr.length);
					break;
				}
			}
		} else {
			for (const pair of blockCommentPairs) {
				if (inner.startsWith(pair.start) && inner.endsWith(pair.end)) {
					inner = inner.substring(pair.start.length, inner.length - pair.end.length);
					break;
				}
			}
		}

		const trimmed = inner.trim();
		if (checkIfContentIsLog(trimmed, config, settings)) {
			if (!isLineIgnored(line)) {
				matches.push({
					start,
					end,
					text: commentText,
					line,
					type: 'commented',
					commentStyle,
					uncommentedText: trimmed
				});
			}
		}
	}

	return matches;
}
