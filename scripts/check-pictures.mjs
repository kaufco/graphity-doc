// Checks the pictures of the guide against STYLE.md without building it: every page, or the pages
// and directories given as arguments. The build makes the same checks.
//
//   npm run check-pictures -- src/content/docs/sccs
import fs from 'node:fs';
import path from 'node:path';
import { pictureProblems } from '../src/lib/legend.mjs';

const pagesIn = (entry) =>
	fs.statSync(entry).isDirectory()
		? fs.readdirSync(entry).flatMap((name) => pagesIn(path.join(entry, name)))
		: /\.mdx?$/.test(entry) ? [entry] : [];

const entries = process.argv.slice(2);
const pages = (entries.length ? entries : ['src/content/docs']).flatMap(pagesIn);
const problems = pages.flatMap((page) => pictureProblems(fs.readFileSync(page, 'utf8')).map((problem) => `${page}: ${problem}`));
console.log(problems.join('\n') || `The pictures of ${pages.length} pages follow STYLE.md.`);
process.exit(problems.length ? 1 : 0);
