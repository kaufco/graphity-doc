// Code regions from the example sources, for <Example>.
//
// A region is marked with Javadoc {@snippet} markup in line comments:
//   // @start region="name"     opens a region (also region=name or region='name')
//   // @end                     closes the innermost open region
//   // @end region="name"       closes the named region
// The marker lines themselves, including those of nested regions, are not part of the extracted code.
import fs from 'node:fs';
import path from 'node:path';
import { guideRelative, requireJavaRoot } from './paths.mjs';

export { AVAILABLE_LANGUAGES, LANGUAGES } from './languages.mjs';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Longer lines wrap in the guide at its standard width.
const MAX_LINE = 90;

const REGION_NAME = String.raw`region\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))`;

function markerPatterns(lineComment) {
	const c = escapeRegExp(lineComment);
	return {
		start: new RegExp(String.raw`^\s*${c}\s*@start\s+${REGION_NAME}\s*$`),
		end: new RegExp(String.raw`^\s*${c}\s*@end(?:\s+${REGION_NAME})?\s*$`),
	};
}

/** All regions of a source text: Map name -> { from, to } (line indices of the markers). */
export function findRegions(text, lineComment, where = 'source') {
	const { start, end } = markerPatterns(lineComment);
	const lines = text.split(/\r?\n/);
	const regions = new Map();
	const open = [];
	lines.forEach((line, i) => {
		let m;
		if ((m = start.exec(line))) {
			const name = m[1] ?? m[2] ?? m[3];
			if (regions.has(name) || open.some((r) => r.name === name)) {
				throw new Error(`${where}:${i + 1}: region "${name}" is defined twice`);
			}
			open.push({ name, from: i });
		} else if ((m = end.exec(line))) {
			const name = m[1] ?? m[2] ?? m[3];
			const at = name === undefined ? open.length - 1 : open.findLastIndex((r) => r.name === name);
			if (at < 0) {
				throw new Error(`${where}:${i + 1}: @end${name === undefined ? '' : ` region="${name}"`} without a matching @start`);
			}
			const [region] = open.splice(at, 1);
			regions.set(region.name, { from: region.from, to: i });
		}
	});
	if (open.length) {
		throw new Error(`${where}:${open[0].from + 1}: region "${open[0].name}" is never closed with @end`);
	}
	return { lines, regions, isMarker: (line) => start.test(line) || end.test(line) };
}

/** Removes the indentation all non-blank lines share, and leading and trailing blank lines. */
function dedent(lines) {
	while (lines.length && !lines[0].trim()) lines.shift();
	while (lines.length && !lines.at(-1).trim()) lines.pop();
	const indents = lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)[0].length);
	const cut = indents.length ? Math.min(...indents) : 0;
	return lines.map((l) => l.slice(cut).trimEnd());
}

/**
 * Loads one region, e.g. loadExample(LANGUAGES[0], 'guide/CondensingCycles.java#condense').
 * Throws an Error that names the file, the region and the regions that do exist.
 */
export function loadExample(language, spec) {
	const hash = spec.indexOf('#');
	if (hash <= 0 || hash === spec.length - 1) {
		throw new Error(`<Example ${language.key}="${spec}">: expected "path/File.ext#region"`);
	}
	const relPath = spec.slice(0, hash);
	const region = spec.slice(hash + 1);
	if (language.key === 'java') requireJavaRoot();
	const file = path.resolve(language.root, language.examples, relPath);
	const shown = guideRelative(file);
	if (!fs.existsSync(file)) {
		throw new Error(`<Example ${language.key}="${spec}">: file ${shown} does not exist`);
	}
	const { lines, regions, isMarker } = findRegions(fs.readFileSync(file, 'utf8'), language.lineComment, shown);
	const range = regions.get(region);
	if (!range) {
		const known = [...regions.keys()].map((r) => `"${r}"`).join(', ') || 'none';
		throw new Error(`<Example ${language.key}="${spec}">: no region "${region}" in ${shown} (regions: ${known})`);
	}
	const shownLines = dedent(lines.slice(range.from + 1, range.to).filter((l) => !isMarker(l)));
	const code = shownLines.join('\n');
	if (!code) throw new Error(`<Example ${language.key}="${spec}">: region "${region}" in ${shown} is empty`);
	const long = shownLines.find((l) => l.length > MAX_LINE);
	if (long) throw new Error(`<Example ${language.key}="${spec}">: longer than ${MAX_LINE} characters in ${shown}: ${long}`);
	const regionLines = `L${range.from + 2}-L${range.to}`;
	return { code, file: shown, region, source: `https://github.com/${language.repository}/blob/${language.ref}/${language.examples}/${relPath}#${regionLines}` };
}
