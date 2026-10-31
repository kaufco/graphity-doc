// Lists every <Gap> of the guide: the use cases Graphity does not support yet.
// Usage: npm run gaps
import { listPages } from './pages.mjs';

/** Blanks fenced code blocks, keeping line breaks, so that examples of <Gap> in code do not count. */
function withoutCodeFences(body) {
	return body.replace(/^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2[`~]*[ \t]*$/gm, (block) => block.replace(/[^\n]/g, ' '));
}

/** The text of a gap, without markup: <Api ref="X" label="Y" /> becomes Y (or X). */
function plainText(mdx) {
	return mdx
		.replace(/<Api\s+([^>]*?)\/>/g, (_, attrs) => {
			const label = /label="([^"]*)"/.exec(attrs) ?? /ref="([^"]*)"/.exec(attrs);
			return label ? label[1] : '';
		})
		.replace(/<[^>]+>/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

let count = 0;
const pages = new Set();
for (const page of listPages()) {
	const body = withoutCodeFences(page.body);
	for (const m of body.matchAll(/<Gap(?:\s[^>]*)?>([\s\S]*?)<\/Gap>/g)) {
		const line = page.bodyLine + body.slice(0, m.index).split('\n').length - 1;
		if (!pages.has(page.file)) console.log(`${pages.size ? '\n' : ''}${page.file} (${page.frontmatter.title ?? 'untitled'})`);
		pages.add(page.file);
		console.log(`  line ${line}: ${plainText(m[1])}`);
		count++;
	}
}
console.log(`\n${count} gap${count === 1 ? '' : 's'} on ${pages.size} page${pages.size === 1 ? '' : 's'}`);
