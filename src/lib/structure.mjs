// The order of the guide: its chapters, and the problems of each chapter, by slug - the path of the
// page under src/content/docs without its extension; a chapter is a directory with an index.mdx.
// This is the only place that orders the pages. The sidebar, the page numbers, the contents page and
// the list of problems on each chapter page all follow from it.
//
// Numbers are never stored: they follow from this order, so inserting a problem renumbers the ones
// after it, while the URLs, which come from the file names, stay the same. Text therefore links to a
// page by its title, never by its number.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { docsDir } from './paths.mjs';

export const CHAPTERS = [
	{
		slug: 'basics',
		problems: [
			'basics/build-from-edges',
			'basics/build-from-objects',
			'basics/build-trees-and-paths',
			'basics/combine-graphs',
			'basics/keep-data',
			'basics/neighbors',
			'basics/result-lists',
			'basics/from-arrays',
		],
	},
	{
		slug: 'order-and-cycles',
		problems: [
			'order-and-cycles/find-cycle',
			'order-and-cycles/topological-order',
			'order-and-cycles/levels',
			'order-and-cycles/root-nodes',
			'order-and-cycles/edge-types',
			'order-and-cycles/break-cycles',
		],
	},
	{
		slug: 'sccs',
		problems: [
			'sccs/find-mutual-dependencies',
			'sccs/condense-to-dag',
			'sccs/order-despite-cycles',
			'sccs/strongly-connected',
			'sccs/strong-bridges',
		],
	},
	{
		slug: 'reachability',
		problems: [
			'reachability/reachable-from',
			'reachability/reaching',
			'reachability/shortest-path',
			'reachability/nearest-and-farthest',
			'reachability/transitive-closure',
			'reachability/transitive-reduction',
		],
	},
	{
		slug: 'undirected',
		problems: [
			'undirected/parts',
			'undirected/bridges',
			'undirected/blocks',
			'undirected/bipartite',
			'undirected/undirected-trees',
		],
	},
	{
		slug: 'trees',
		problems: [
			'trees/shapes',
			'trees/parents-and-depths',
			'trees/common-ancestor',
			'trees/ancestor-test',
			'trees/subtrees',
		],
	},
	{
		slug: 'dominance',
		problems: [
			'dominance/dominators',
			'dominance/dominator-tree',
			'dominance/post-dominators',
			'dominance/several-entries',
		],
	},
	{
		slug: 'control-flow',
		problems: [
			'control-flow/find-loops',
			'control-flow/irreducible-loops',
			'control-flow/dominance-frontiers',
			'control-flow/phi-nodes',
			'control-flow/control-dependence',
		],
	},
	{
		slug: 'transforming',
		problems: [
			'transforming/subgraph',
			'transforming/renumber',
			'transforming/node-data',
			'transforming/edge-data',
			'transforming/transpose',
			'transforming/own-groups',
			'transforming/reduce-data',
		],
	},
	{
		slug: 'storing',
		problems: ['storing/save-and-load', 'storing/hash', 'storing/diff'],
	},
	{
		slug: 'showing',
		problems: [
			'showing/text',
			'showing/graphviz',
			'showing/graphviz-styled',
			'showing/mermaid',
			'showing/mermaid-styled',
		],
	},
	{
		slug: 'searches',
		problems: ['searches/dfs', 'searches/dfs-edges', 'searches/breadth-first', 'searches/arrays'],
	},
];

function frontmatterOf(slug) {
	for (const file of [`${slug}.mdx`, `${slug}.md`, `${slug}/index.mdx`, `${slug}/index.md`]) {
		const abs = path.join(docsDir, file);
		if (!fs.existsSync(abs)) continue;
		const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(abs, 'utf8'));
		const frontmatter = (m && yaml.load(m[1])) || {};
		if (!frontmatter.title) throw new Error(`src/content/docs/${file} has no title`);
		return frontmatter;
	}
	throw new Error(`src/lib/structure.mjs lists "${slug}", but src/content/docs has no page for it`);
}

function page(slug, number) {
	const { title, description } = frontmatterOf(slug);
	return { slug, number, title, description: description ?? '' };
}

/**
 * The chapters in order, each { slug, number, title, description, problems }, and each problem
 * { slug, number, title, description }: chapter "2", problem "2.1".
 */
export function guideStructure() {
	return CHAPTERS.map((chapter, i) => {
		const number = String(i + 1);
		return {
			...page(chapter.slug, number),
			problems: chapter.problems.map((slug, j) => page(slug, `${number}.${j + 1}`)),
		};
	});
}

/** The number of every chapter and problem page, by slug. */
export function pageNumbers() {
	const numbers = new Map();
	for (const chapter of guideStructure()) {
		numbers.set(chapter.slug, chapter.number);
		for (const problem of chapter.problems) numbers.set(problem.slug, problem.number);
	}
	return numbers;
}

/** The chapter of a chapter or problem page, or undefined. */
export function chapterOf(slug) {
	return guideStructure().find((c) => c.slug === slug || c.problems.some((p) => p.slug === slug));
}
