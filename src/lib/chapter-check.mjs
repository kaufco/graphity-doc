// Checks a finished build against the pages: that the contents page lists every chapter and problem,
// that each chapter lists all its problems, and that a chapter or problem opens with the sentence that
// these lists show. The pages come from the directories, not from src/lib/structure.mjs: a page that the
// order leaves out is found as well. A chapter is a directory with an index.mdx, and each other page in
// it a problem.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { docsDir } from './paths.mjs';

const frontmatter = (file) => yaml.load(/^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(file, 'utf8'))[1]);

function pagesOnDisk() {
	return fs
		.readdirSync(docsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && fs.existsSync(path.join(docsDir, entry.name, 'index.mdx')))
		.map(({ name }) => ({
			slug: name,
			...frontmatter(path.join(docsDir, name, 'index.mdx')),
			problems: fs
				.readdirSync(path.join(docsDir, name))
				.filter((file) => file.endsWith('.mdx') && file !== 'index.mdx')
				.map((file) => {
					const slug = `${name}/${file.replace(/\.mdx$/, '')}`;
					return { slug, ...frontmatter(path.join(docsDir, `${slug}.mdx`)) };
				}),
		}));
}

/** The text of a piece of HTML, as a reader sees it. */
const textOf = (html) =>
	html
		.replace(/<[^>]*>/g, '')
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
		.replace(/&quot;/g, '"')
		.replace(/&gt;/g, '>')
		.replace(/&lt;/g, '<')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();

/** The problems that a list in a piece of HTML links, by slug, each with its sentence. */
function listed(html) {
	const items = new Map();
	for (const [, href, sentence] of html.matchAll(/<li[^>]*>\s*<a href="[^"]*?\/([^/"]+\/[^/"]+)\/"[^>]*>[\s\S]*?<\/a>\s*<span class="problem-description"[^>]*>([\s\S]*?)<\/span>/g)) {
		items.set(href, textOf(sentence));
	}
	return items;
}

/** What is wrong with the sentence of a page, read as one sentence that says what the page does. */
function sentenceProblem(sentence, start) {
	if (typeof sentence !== 'string' || !sentence) return 'has no description';
	if (!sentence.startsWith(start)) return `has a description that does not start with "${start}"`;
	if (!sentence.endsWith('.') || /[.!?]\s/.test(sentence)) return 'has a description that is not one sentence';
	return undefined;
}

/** What does not hold in the build in `dist`, as a list of messages. */
export function chapterProblems(dist) {
	const problems = [];
	const html = (slug) => fs.readFileSync(path.join(dist, slug, 'index.html'), 'utf8');
	const content = (page) => /<div class="sl-markdown-content"[^>]*>([\s\S]*)/.exec(page)?.[1] ?? '';
	const contents = html('contents');

	const compare = (where, wanted, found) => {
		for (const { slug, description } of wanted) {
			if (!found.has(slug)) problems.push(`${where} does not list ${slug}`);
			else if (found.get(slug) !== description) problems.push(`${where} shows another sentence for ${slug}: ${found.get(slug)}`);
		}
		for (const slug of found.keys()) {
			if (!wanted.some((page) => page.slug === slug)) problems.push(`${where} lists ${slug}, which is not one of its pages`);
		}
	};
	const opens = (page, slug, description) => {
		const first = /^\s*<p[^>]*>([\s\S]*?)<\/p>/.exec(content(page))?.[1];
		if (first === undefined || textOf(first) !== description) problems.push(`${slug} does not open with its sentence: ${description}`);
	};

	for (const chapter of pagesOnDisk()) {
		const problem = sentenceProblem(chapter.description, 'This chapter ');
		if (problem) problems.push(`${chapter.slug} ${problem}`);
		const page = html(chapter.slug);
		opens(page, chapter.slug, chapter.description);

		const entry = new RegExp(`<h2 id="${chapter.slug}"[\\s\\S]*?(?=<h2 id=|$)`).exec(contents)?.[0];
		if (!entry) {
			problems.push(`The contents page does not list the chapter ${chapter.slug}`);
			continue;
		}
		const sentence = /<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/.exec(entry)?.[1];
		if (sentence === undefined || textOf(sentence) !== chapter.description) {
			problems.push(`The contents page shows another sentence for ${chapter.slug}`);
		}
		compare('The contents page', chapter.problems, listed(entry));

		const list = /id="problems-in-this-chapter"[\s\S]*?<\/ul>/.exec(page)?.[0];
		if (!list) {
			problems.push(`${chapter.slug} has no list "Problems in this chapter"`);
			continue;
		}
		compare(`The chapter ${chapter.slug}`, chapter.problems, listed(list));

		for (const { slug, description } of chapter.problems) {
			const issue = sentenceProblem(description, 'You ');
			if (issue) problems.push(`${slug} ${issue}`);
			opens(html(slug), slug, description);
		}
	}
	return problems;
}
