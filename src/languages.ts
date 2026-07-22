import * as path from 'path';

export interface LanguageConfig {
	name: string;
	extensions: string[];
	logPrefixes: string[];
	lineCommentStart: string | string[];
	blockCommentStart?: string;
	blockCommentEnd?: string;
	stringDelimiters?: string[];
}

export const LANGUAGE_CONFIGS: LanguageConfig[] = [
	{
		name: 'javascript',
		extensions: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx'],
		logPrefixes: [
			'console.log',
			'console.info',
			'console.debug',
			'console.warn',
			'console.error',
			'console.trace',
			'debugger'
		],
		lineCommentStart: '//',
		blockCommentStart: '/*',
		blockCommentEnd: '*/',
		stringDelimiters: ["'", '"', '`']
	},
	{
		name: 'vue',
		extensions: ['.vue'],
		logPrefixes: [
			'console.log',
			'console.info',
			'console.debug',
			'console.warn',
			'console.error',
			'console.trace',
			'debugger'
		],
		lineCommentStart: '//',
		blockCommentStart: '/*',
		blockCommentEnd: '*/',
		stringDelimiters: ["'", '"', '`']
	},
	{
		name: 'dart',
		extensions: ['.dart'],
		logPrefixes: ['print'],
		lineCommentStart: '//',
		blockCommentStart: '/*',
		blockCommentEnd: '*/',
		stringDelimiters: ["'", '"', '`']
	},
	{
		name: 'java',
		extensions: ['.java'],
		logPrefixes: ['System.out.println', 'println'],
		lineCommentStart: '//',
		blockCommentStart: '/*',
		blockCommentEnd: '*/',
		stringDelimiters: ['"']
	},
	{
		name: 'kotlin',
		extensions: ['.kt', '.kts'],
		logPrefixes: ['println', 'print'],
		lineCommentStart: '//',
		blockCommentStart: '/*',
		blockCommentEnd: '*/',
		stringDelimiters: ['"']
	},
	{
		name: 'swift',
		extensions: ['.swift'],
		logPrefixes: ['print', 'NSLog'],
		lineCommentStart: '//',
		blockCommentStart: '/*',
		blockCommentEnd: '*/',
		stringDelimiters: ['"']
	},
	{
		name: 'csharp',
		extensions: ['.cs'],
		logPrefixes: [
			'Console.WriteLine',
			'System.Console.WriteLine',
			'Debug.WriteLine',
			'Console.Write'
		],
		lineCommentStart: '//',
		blockCommentStart: '/*',
		blockCommentEnd: '*/',
		stringDelimiters: ['"']
	},
	{
		name: 'php',
		extensions: ['.php'],
		logPrefixes: ['print_r', 'var_dump', 'echo', 'print'],
		lineCommentStart: ['//', '#'],
		blockCommentStart: '/*',
		blockCommentEnd: '*/',
		stringDelimiters: ["'", '"']
	},
	{
		name: 'python',
		extensions: ['.py'],
		logPrefixes: ['print'],
		lineCommentStart: '#',
		blockCommentStart: '"""',
		blockCommentEnd: '"""',
		stringDelimiters: ["'", '"']
	},
	{
		name: 'go',
		extensions: ['.go'],
		logPrefixes: ['fmt.Println', 'println', 'print'],
		lineCommentStart: '//',
		blockCommentStart: '/*',
		blockCommentEnd: '*/',
		stringDelimiters: ['"', '`']
	},
	{
		name: 'rust',
		extensions: ['.rs'],
		logPrefixes: ['println!', 'print!'],
		lineCommentStart: '//',
		blockCommentStart: '/*',
		blockCommentEnd: '*/',
		stringDelimiters: ['"']
	}
];

export function getLanguageConfig(filePath: string): LanguageConfig | undefined {
	const ext = path.extname(filePath).toLowerCase();
	return LANGUAGE_CONFIGS.find(config => config.extensions.includes(ext));
}

export function getLanguageConfigByLanguageId(languageId: string): LanguageConfig | undefined {
	const mappedId = languageId.toLowerCase();
	if (mappedId.includes('javascript') || mappedId.includes('typescript')) {
		return LANGUAGE_CONFIGS.find(c => c.name === 'javascript');
	}
	return LANGUAGE_CONFIGS.find(config => config.name === mappedId);
}
