// The content pages, with their frontmatter, for the scripts in this directory.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { docsDir } from '../src/lib/paths.mjs';

/** All .md and .mdx pages: { file (relative to src/content/docs), frontmatter, body, bodyLine }. */
export function listPages() {
	return fs
		.readdirSync(docsDir, { recursive: true, withFileTypes: true })
		.filter((e) => e.isFile() && /\.mdx?$/.test(e.name))
		.map((e) => path.join(e.parentPath, e.name))
		.sort()
		.map((abs) => {
			const text = fs.readFileSync(abs, 'utf8');
			const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
			const file = path.relative(docsDir, abs).split(path.sep).join('/');
			let frontmatter = {};
			if (m) {
				try {
					frontmatter = yaml.load(m[1]) ?? {};
				} catch (error) {
					throw new Error(`${file}: invalid frontmatter: ${error.message}`);
				}
			}
			const body = m ? text.slice(m[0].length) : text;
			const bodyLine = m ? m[0].split('\n').length : 1; // line number of the body's first line
			return { file, frontmatter, body, bodyLine };
		});
}
