// How much of the public API of the published modules the guide covers: compares the public
// methods and constructors (overloads merged) with the `api` frontmatter of all pages. Also checks
// that the API mapping of each other language in the build has an entry for every declaration.
// Usage: npm run api-coverage
import fs from 'node:fs';
import path from 'node:path';
import { COMMON_OBJECT_METHODS, coverageKey, javaApi, PUBLISHED_MODULES, resolveRef } from '../src/lib/java-api.mjs';
import { mappingProblems } from '../src/lib/lang-api.mjs';
import { PORTS } from '../src/lib/languages.mjs';
import { guideRoot } from '../src/lib/paths.mjs';
import { listPages } from './pages.mjs';

const EXCLUSIONS_FILE = 'api-coverage-exclusions.txt';

function readExclusions() {
	const file = path.join(guideRoot, EXCLUSIONS_FILE);
	if (!fs.existsSync(file)) return [];
	return fs
		.readFileSync(file, 'utf8')
		.split(/\r?\n/)
		.map((line, i) => ({ entry: line.replace(/#.*/, '').trim(), line: i + 1 }))
		.filter(({ entry }) => entry);
}

/** The display name of a member in the lists: `sccsOf`, or `new GraphBuilder` for constructors. */
const memberName = (type, member) => (member.kind === 'constructor' ? `new ${type.simpleName}` : member.name);

// The API: one entry per class and method name (or per class for its constructors).
const index = javaApi();
const api = new Map(); // coverageKey -> { type, name, excluded }
let protectedCount = 0;
for (const type of index.published) {
	for (const member of type.members) {
		if (member.visibility === 'protected') protectedCount++;
		if (member.visibility !== 'public' || member.implicit || COMMON_OBJECT_METHODS.has(member.name)) continue;
		api.set(coverageKey(type, member), { type, name: memberName(type, member), excluded: false });
	}
}

const unusedExclusions = [];
for (const { entry, line } of readExclusions()) {
	const matches = [...api.values()].filter(
		({ type, name }) =>
			entry === type.name ||
			entry === `${type.name}.${name}` ||
			(name.startsWith('new ') && entry === `new ${type.name}`),
	);
	if (matches.length === 0) unusedExclusions.push(`${EXCLUSIONS_FILE}:${line}: "${entry}" matches no public method`);
	for (const m of matches) m.excluded = true;
}

// The guide: the union of all `api` frontmatter entries.
const covered = new Set();
const unresolved = [];
const pages = listPages();
let pagesWithApi = 0;
for (const page of pages) {
	const refs = page.frontmatter.api ?? [];
	if (refs.length) pagesWithApi++;
	for (const ref of refs) {
		try {
			const target = resolveRef(ref, index);
			if (target.coverageKey) covered.add(target.coverageKey);
		} catch (error) {
			unresolved.push(`${page.file}: ${error.message}`);
		}
	}
}

const counted = [...api.entries()].filter(([, m]) => !m.excluded);
const coveredCount = counted.filter(([key]) => covered.has(key)).length;
const percent = counted.length ? ((100 * coveredCount) / counted.length).toFixed(1) : '0.0';
const excludedCount = api.size - counted.length;

console.log(`API coverage: ${percent}% (${coveredCount} of ${counted.length} public methods and constructors)`);
console.log(
	`  Modules: ${PUBLISHED_MODULES.join(', ')}. Overloads count once, inherited methods at their declaring class.\n` +
		`  Left out: equals, hashCode, toString, ${protectedCount} protected members` +
		`${excludedCount ? `, ${excludedCount} entries excluded in ${EXCLUSIONS_FILE}` : ''}.\n` +
		`  Source: the "api" frontmatter of ${pagesWithApi} of ${pages.length} pages.`,
);

const byType = new Map();
for (const [key, m] of counted) {
	if (covered.has(key)) continue;
	if (!byType.has(m.type)) byType.set(m.type, []);
	byType.get(m.type).push(m.name);
}
if (byType.size) {
	console.log('\nNot covered, by class:');
	const types = [...byType.keys()].sort(
		(a, b) => PUBLISHED_MODULES.indexOf(a.module) - PUBLISHED_MODULES.indexOf(b.module) || a.name.localeCompare(b.name),
	);
	let module;
	for (const type of types) {
		if (type.module !== module) console.log(`\n  ${(module = type.module)}`);
		const names = [...new Set(byType.get(type))].sort((a, b) => Number(b.startsWith('new ')) - Number(a.startsWith('new ')) || a.localeCompare(b));
		console.log(`    ${type.name}: ${names.join(', ')}`);
	}
}
// The mappings of the other languages of the build: one entry for each declaration of the public API.
const mappings = PORTS.flatMap((language) => mappingProblems(language, index));
if (PORTS.length) {
	console.log(`\nMappings of ${PORTS.map((l) => l.label).join(', ')}: ${mappings.length ? `${mappings.length} problems` : 'complete'}.`);
}

for (const list of [unusedExclusions, unresolved, mappings]) {
	if (list.length) console.log(`\n${list.join('\n')}`);
}
process.exitCode = unresolved.length || unusedExclusions.length || mappings.length ? 1 : 0;
