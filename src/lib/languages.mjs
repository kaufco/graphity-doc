// The languages of the guide: Java, and the ports of the library to other languages. A language is in
// a build when its library is there - in languages/<key>/, where `npm run languages` checks out the
// version that languages.json names, or in the directory that GRAPHITY_<KEY>_ROOT names, relative to
// the guide directory (GRAPHITY_JAVA_ROOT, GRAPHITY_RUST_ROOT, ...). Java has to be there; each other
// language that is there is shown in full: every example, every name in the text and every API link
// in that language, or the build fails.
import fs from 'node:fs';
import path from 'node:path';
import { guideRoot } from './paths.mjs';

/** `BuildingAndReading` -> ['building', 'and', 'reading']; `UsingCsrArrays` -> ['using', 'csr', 'arrays']. */
const words = (name) =>
	name
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.split(' ');
const upperFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * One row per language, in the order of the language picker. `examples` is the directory of the
 * example sources within the library, and `exampleFile` names the file that holds the counterpart of
 * a Java example, from its directories and its class name: the same directories and region names,
 * the file named in the language's convention. `apiMap` is the file within the library that maps the
 * Java API references to the language's names (src/lib/lang-api.mjs), `apiDocs` the published API
 * documentation and `localApiDocs` where the library's own build puts it (npm run
 * build:local-javadoc; the mapping's "docRoot" says the same). `shortName` turns a name of the
 * mapping into the form the text shows, as the Java text shows `Components.sccsOf` without its
 * package. `lang` is the Expressive Code language id, `lineComment` the comment syntax of the region
 * markers, `extension` that of the language's source files (src/programs/, <Program>).
 */
const TABLE = [
	{
		key: 'java',
		label: 'Java',
		lang: 'java',
		extension: 'java',
		examples: 'graphity-examples/src/main/java/com/kobayami/graphity/examples',
		exampleFile: (dirs, name) => [...dirs, `${name}.java`],
		apiMap: null,
		apiDocs: 'https://kaufco.github.io/graphity/',
		localApiDocs: 'target/reports/apidocs',
		lineComment: '//',
	},
	{
		key: 'rust',
		label: 'Rust',
		lang: 'rust',
		extension: 'rs',
		examples: 'graphity-examples/src',
		exampleFile: (dirs, name) => [...dirs, `${words(name).join('_')}.rs`],
		apiMap: 'graphity-examples/api-rust.json',
		apiDocs: 'https://kaufco.github.io/graphity-rust/',
		localApiDocs: 'target/doc',
		// `graphity_core::components::sccs_of` -> `components::sccs_of`,
		// `<graphity_core::Graph as std::fmt::Display>::fmt` -> `<Graph as Display>::fmt`
		shortName: (name) => name.replace(/\bgraphity_\w+::/g, '').replace(/\bstd::(?:\w+::)*/g, ''),
		lineComment: '//',
	},
	{
		key: 'ts',
		label: 'TypeScript',
		lang: 'ts',
		extension: 'ts',
		examples: 'packages/examples/src',
		exampleFile: (dirs, name) => [...dirs, `${lowerFirst(name)}.ts`],
		apiMap: 'packages/examples/api-ts.json',
		apiDocs: 'https://kaufco.github.io/graphity-ts/',
		localApiDocs: 'api-docs/dist',
		lineComment: '//',
	},
	{
		key: 'csharp',
		label: 'C#',
		lang: 'csharp',
		extension: 'cs',
		examples: 'examples/Graphity.Examples',
		exampleFile: (dirs, name) => [...dirs.map(upperFirst), `${name}.cs`],
		apiMap: 'examples/api-csharp.json',
		apiDocs: 'https://kaufco.github.io/graphity-csharp/',
		localApiDocs: 'docs/api',
		lineComment: '//',
	},
];

/**
 * Where a language keeps the counterpart of a Java example: 'guide/FindingLoops.java#loops' becomes
 * 'guide/finding_loops.rs#loops' in Rust, 'guide/findingLoops.ts#loops' in TypeScript and
 * 'Guide/FindingLoops.cs#loops' in C#.
 */
export function counterpartOf(language, javaSpec) {
	const m = /^((?:[\w.-]+\/)*)(\w+)\.java#(.+)$/.exec(javaSpec);
	if (!m) throw new Error(`"${javaSpec}" is not of the form path/File.java#region`);
	const dirs = m[1] ? m[1].slice(0, -1).split('/') : [];
	return `${language.exampleFile(dirs, m[2]).join('/')}#${m[3]}`;
}

/** The environment variable that points a build at a library of the language. */
export const rootVariable = (key) => `GRAPHITY_${key.toUpperCase()}_ROOT`;

/** The directory of the language's library, or null if this build does not have it. */
export function languageRoot(key) {
	const fromEnv = process.env[rootVariable(key)];
	const dir = path.resolve(guideRoot, fromEnv || path.join('languages', key));
	return fs.existsSync(dir) ? dir : null;
}

/**
 * Every language the guide knows, each with `root`, the directory of its library or null,
 * `repository` and `ref`, where languages.json says it is published, and `apiDocs`, overridden by
 * GRAPHITY_<KEY>_API_URL or by "apiDocs" in languages.json.
 */
export const LANGUAGES = TABLE.map((language) => {
	const pinned = readPinned()[language.key] ?? {};
	return {
		shortName: (name) => name,
		...language,
		root: languageRoot(language.key),
		repository: pinned.repository,
		ref: pinned.ref,
		apiDocs: (process.env[`GRAPHITY_${language.key.toUpperCase()}_API_URL`] || pinned.apiDocs || language.apiDocs).replace(/\/?$/, '/'),
	};
});

/** The languages of this build, Java first. */
export const AVAILABLE_LANGUAGES = LANGUAGES.filter((language) => language.root);

/** The languages of this build other than Java. */
export const PORTS = AVAILABLE_LANGUAGES.filter((language) => language.key !== 'java');

function readPinned() {
	const file = path.join(guideRoot, 'languages.json');
	return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}
