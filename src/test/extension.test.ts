import * as assert from 'assert';
import { scanFile } from '../scanner';
import { getLanguageConfigByLanguageId } from '../languages';
import { LogSweeperSettings } from '../types';

suite('LogSweeper Unit Test Suite', () => {
	const defaultSettings: LogSweeperSettings = {
		commentMode: 'block',
		backupEnabled: false,
		autoCleanupBackups: false,
		backupFolder: '.logsweeper-backups',
		backupLimit: 10,
		backupMaxAgeDays: 1,
		includeConsoleWarn: true,
		includeConsoleError: true,
		includeConsoleDebug: true,
		includeConsoleInfo: true,
		includeConsoleTrace: true,
		includeDebuggerStatements: true,
		workspaceExclusions: [],
		ignorePatterns: [],
		previewBeforeApplying: false
	};

	test('JS: Scan uncommented console.log', () => {
		const config = getLanguageConfigByLanguageId('javascript');
		assert.ok(config);

		const code = 'const x = 5;\nconsole.log(x);\nconst y = 10;';
		const matches = scanFile(code, config!, defaultSettings);

		assert.strictEqual(matches.length, 1);
		assert.strictEqual(matches[0].type, 'uncommented');
		assert.strictEqual(matches[0].text, 'console.log(x);');
		assert.strictEqual(matches[0].line, 2);
	});

	test('JS: Scan commented console.log', () => {
		const config = getLanguageConfigByLanguageId('javascript');
		assert.ok(config);

		const code = '/* console.log("hello"); */\n// console.info("test");';
		const matches = scanFile(code, config!, defaultSettings);

		assert.strictEqual(matches.length, 2);
		assert.strictEqual(matches[0].type, 'commented');
		assert.strictEqual(matches[0].commentStyle, 'block');
		assert.strictEqual(matches[0].uncommentedText, 'console.log("hello");');

		assert.strictEqual(matches[1].type, 'commented');
		assert.strictEqual(matches[1].commentStyle, 'line');
		assert.strictEqual(matches[1].uncommentedText, 'console.info("test");');
	});

	test('JS: Ignore comments (logsweeper-ignore)', () => {
		const config = getLanguageConfigByLanguageId('javascript');
		assert.ok(config);

		const code = `
			// logsweeper-ignore
			console.log("ignored 1");

			console.log("active 1"); // logsweeper-ignore

			console.log("active 2");
		`;
		const matches = scanFile(code, config!, defaultSettings);

		// Only "active 2" should be processed, because first is ignored by line-above, second by same-line
		assert.strictEqual(matches.length, 1);
		assert.strictEqual(matches[0].text, 'console.log("active 2");');
	});

	test('JS: Nested parentheses and string literals', () => {
		const config = getLanguageConfigByLanguageId('javascript');
		assert.ok(config);

		const code = 'console.log("nested) (parens", Math.max(1, 2));';
		const matches = scanFile(code, config!, defaultSettings);

		assert.strictEqual(matches.length, 1);
		assert.strictEqual(matches[0].text, 'console.log("nested) (parens", Math.max(1, 2));');
	});

	test('JS: Debugger statements', () => {
		const config = getLanguageConfigByLanguageId('javascript');
		assert.ok(config);

		const code = 'const a = 1;\ndebugger;\nconst b = 2;';
		const matches = scanFile(code, config!, defaultSettings);

		assert.strictEqual(matches.length, 1);
		assert.strictEqual(matches[0].text, 'debugger;');
		assert.strictEqual(matches[0].type, 'uncommented');
	});

	test('Python: Print statements scan', () => {
		const config = getLanguageConfigByLanguageId('python');
		assert.ok(config);

		const code = 'print("hello python")\n# print("commented python")';
		const matches = scanFile(code, config!, defaultSettings);

		assert.strictEqual(matches.length, 2);
		assert.strictEqual(matches[0].type, 'uncommented');
		assert.strictEqual(matches[0].text, 'print("hello python")');

		assert.strictEqual(matches[1].type, 'commented');
		assert.strictEqual(matches[1].uncommentedText, 'print("commented python")');
	});

	test('Go & Rust: println scan', () => {
		const goConfig = getLanguageConfigByLanguageId('go');
		const rustConfig = getLanguageConfigByLanguageId('rust');
		assert.ok(goConfig);
		assert.ok(rustConfig);

		const goCode = 'fmt.Println("go")';
		const goMatches = scanFile(goCode, goConfig!, defaultSettings);
		assert.strictEqual(goMatches.length, 1);
		assert.strictEqual(goMatches[0].text, 'fmt.Println("go")');

		const rustCode = 'println!("rust")';
		const rustMatches = scanFile(rustCode, rustConfig!, defaultSettings);
		assert.strictEqual(rustMatches.length, 1);
		assert.strictEqual(rustMatches[0].text, 'println!("rust")');
	});

	test('Java & Swift: output methods scan', () => {
		const javaConfig = getLanguageConfigByLanguageId('java');
		const swiftConfig = getLanguageConfigByLanguageId('swift');
		assert.ok(javaConfig);
		assert.ok(swiftConfig);

		const javaCode = 'System.out.println("java");';
		const javaMatches = scanFile(javaCode, javaConfig!, defaultSettings);
		assert.strictEqual(javaMatches.length, 1);
		assert.strictEqual(javaMatches[0].text, 'System.out.println("java");');

		const swiftCode = 'NSLog("swift")';
		const swiftMatches = scanFile(swiftCode, swiftConfig!, defaultSettings);
		assert.strictEqual(swiftMatches.length, 1);
		assert.strictEqual(swiftMatches[0].text, 'NSLog("swift")');
	});

	test('Filter by settings (warn/error disabled)', () => {
		const config = getLanguageConfigByLanguageId('javascript');
		assert.ok(config);

		const code = 'console.warn("warn");\nconsole.error("error");\nconsole.log("log");';
		const disabledSettings = {
			...defaultSettings,
			includeConsoleWarn: false,
			includeConsoleError: false
		};

		const matches = scanFile(code, config!, disabledSettings);

		assert.strictEqual(matches.length, 1);
		assert.strictEqual(matches[0].text, 'console.log("log");');
	});
});
