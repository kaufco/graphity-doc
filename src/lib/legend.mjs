// The marks of the pictures, and which of them a diagram uses. A diagram says so in its Mermaid
// source: a mark on a node or group is a `class` statement, a mark on an edge a `linkStyle` statement.
// Inputs are blue, outputs green, on nodes, edges and groups alike; a group has the color of a node
// with a thinner border and a fainter fill. Context, what a picture points out although the code
// neither takes nor returns it, has the color of its role, such as orange for an edge on a cycle. A
// picture can give a mark the name it has there, such as `Strong bridge` for an output edge.

const CLASS = (name) => new RegExp(String.raw`^\s*class\s+\S+\s+${name}\s*;?\s*$`, 'm');
const LINK = (style) => new RegExp(String.raw`^\s*linkStyle\s+\S+\s+(?:marker-end:none,)?${style}\s*;?\s*$`, 'm');
const HIDDEN = 'fill:none,stroke:none,color:#ffffff00';

/** The columns of a legend, in their order. */
const COLUMNS = [
	{ key: 'input', title: 'Input' },
	{ key: 'context', title: 'Context' },
	{ key: 'output', title: 'Output' },
];

const BLUE = '#3b82f6';
const GREEN = '#10b981';

/**
 * `shape` is how the legend draws the mark; `style` is what its classDef or linkStyle statement says.
 */
const MARKS = [
	{ key: 'inputGroup', name: 'Input group', column: 'input', shape: 'frame', color: BLUE, fill: `${BLUE}14`, width: 1, style: `fill:${BLUE}14,stroke:${BLUE},stroke-width:1px` },
	{ key: 'inputNode', name: 'Input node', column: 'input', shape: 'node', color: BLUE, fill: `${BLUE}26`, width: 2, style: `fill:${BLUE}26,stroke:${BLUE},stroke-width:2px,color:#1f2328` },
	{ key: 'inputEdge', name: 'Input edge', column: 'input', shape: 'edge', color: BLUE, width: 3, style: `stroke:${BLUE},stroke-width:3px` },
	{ key: 'contextGroup', name: 'Context group', column: 'context', shape: 'frame', color: '#9ca3af', fill: '#9ca3af14', width: 1, style: 'fill:#9ca3af14,stroke:#9ca3af,stroke-width:1px' },
	{ key: 'contextNode', name: 'Context node', column: 'context', shape: 'node', color: '#8b5cf6', fill: '#ececff', width: 3, style: 'stroke:#8b5cf6,stroke-width:3px' },
	{ key: 'cycleEdge', name: 'Edge on a cycle', column: 'context', shape: 'edge', color: '#f59e0b', width: 3, style: 'stroke:#f59e0b,stroke-width:3px' },
	{ key: 'omittedEdge', name: 'Omitted edge', column: 'context', shape: 'edge', color: '#9ca3af', width: 2, dash: '4 3', style: 'stroke:#9ca3af,stroke-dasharray:4 3' },
	{ key: 'outputGroup', name: 'Output group', column: 'output', shape: 'frame', color: GREEN, fill: `${GREEN}14`, width: 1, style: `fill:${GREEN}14,stroke:${GREEN},stroke-width:1px` },
	{ key: 'outputNode', name: 'Output node', column: 'output', shape: 'node', color: GREEN, fill: `${GREEN}26`, width: 2, style: `fill:${GREEN}26,stroke:${GREEN},stroke-width:2px,color:#1f2328` },
	{ key: 'outputEdge', name: 'Output edge', column: 'output', shape: 'edge', color: GREEN, width: 3, style: `stroke:${GREEN},stroke-width:3px` },
	{ key: 'removedEdge', name: 'Removed edge', column: 'output', shape: 'edge', color: GREEN, width: 3, dash: '4 3', style: `stroke:${GREEN},stroke-width:3px,stroke-dasharray:4 3` },
];

/** The keys of the marks that a Mermaid source uses. */
export const marksOf = (source) =>
	MARKS.filter((mark) => (mark.shape === 'edge' ? LINK(mark.style) : CLASS(mark.key)).test(source)).map((mark) => mark.key);

/**
 * The legend of the diagrams in a piece of rendered HTML (src/lib/mermaid.mjs): the columns that have
 * an entry, each with the marks they use, with `names` in place of the general names, as in
 * { outputEdge: 'Strong bridge' }.
 */
export function legendColumns(html, names) {
	const keys = new Set([...html.matchAll(/data-marks="([^"]*)"/g)].flatMap((m) => m[1].split(' ').filter(Boolean)));
	const arrow = html.includes('data-arrows="true"');
	const marks = MARKS.filter((mark) => keys.has(mark.key)).map((mark) => ({ ...mark, arrow, name: names[mark.key] ?? mark.name }));
	return COLUMNS.map((c) => ({ ...c, entries: marks.filter((mark) => mark.column === c.key) })).filter((c) => c.entries.length);
}

const GRAPH_MARKS = new Map(MARKS.filter((mark) => mark.shape !== 'edge').map((mark) => [mark.key, mark]));
const EDGE_STYLES = new Set(MARKS.filter((mark) => mark.shape === 'edge').map((mark) => mark.style));

/** What in one Mermaid source does not follow STYLE.md, as a list of messages. */
function diagramProblems(source) {
	const problems = [];
	const groups = new Set([...source.matchAll(/^\s*subgraph\s+(\w+)/gm)].map((m) => m[1]));
	const defined = new Set();
	for (const [, name, style] of source.matchAll(/^\s*classDef\s+(\S+)\s+(\S.*?)\s*;?\s*$/gm)) {
		defined.add(name);
		const wanted = name === 'hidden' ? HIDDEN : GRAPH_MARKS.get(name)?.style;
		if (!wanted) problems.push(`classDef ${name} is not a mark`);
		else if (style !== wanted) problems.push(`classDef ${name} is not "${wanted}"`);
	}
	const marked = new Map();
	for (const [, ids, name] of source.matchAll(/^\s*class\s+(\S+)\s+(\S+?)\s*;?\s*$/gm)) {
		if (!defined.has(name)) problems.push(`class ${name} has no classDef`);
		const mark = GRAPH_MARKS.get(name);
		for (const id of ids.split(',')) {
			if (mark && (mark.shape === 'frame') !== groups.has(id)) problems.push(`${name} on ${id}, which is not a ${mark.shape === 'frame' ? 'group' : 'node'}`);
			if (marked.has(id) && marked.get(id) !== name) problems.push(`${id} has two marks, ${marked.get(id)} and ${name}`);
			marked.set(id, name);
		}
	}
	const styled = new Set();
	for (const [, edges, style] of source.matchAll(/^\s*linkStyle\s+(\S+)\s+(\S.*?)\s*;?\s*$/gm)) {
		const mark = style.replace(/^marker-end:none,?/, '');
		if (!mark) continue;
		if (!EDGE_STYLES.has(mark)) problems.push(`linkStyle ${edges}: "${mark}" is not a mark`);
		for (const edge of edges.split(',')) {
			if (styled.has(edge)) problems.push(`edge ${edge} has two marks`);
			styled.add(edge);
		}
	}
	if (/^\s*style\s/m.test(source)) problems.push('a style statement; marks are classes and linkStyle');
	if (source.includes(':::')) problems.push('a class on a node with :::; the legend reads class statements');
	return problems;
}

const OUTPUTS = new Set(MARKS.filter((mark) => mark.column === 'output').map((mark) => mark.key));
const FENCE = String.raw`\`\`\`mermaid([^\n]*)\n([\s\S]*?)\`\`\``;
const PICTURE = new RegExp(String.raw`<(Compare|Figure)\b([\s\S]*?)>\s*\n([\s\S]*?)</\1>|${FENCE}`, 'g');

/**
 * What in the text of a page does not follow STYLE.md, as a list of messages with their lines. A block
 * marked ```mermaid verbatim is what a writer of the library wrote, with the classes of its example.
 */
export function pictureProblems(text) {
	const problems = [];
	const report = (index, messages) => {
		const line = text.slice(0, index).split('\n').length;
		problems.push(...messages.map((message) => `line ${line}: ${message}`));
	};
	for (const match of text.matchAll(PICTURE)) {
		const [, tag, attributes, body, meta, source] = match;
		if (!tag) {
			if (meta.includes('verbatim')) continue;
			report(match.index, diagramProblems(source));
			if (marksOf(source).length) report(match.index, ['a picture with marks goes into <Figure>, for its legend']);
			continue;
		}
		const sources = [...body.matchAll(new RegExp(FENCE, 'g'))].map((m) => m[2]);
		report(match.index, sources.flatMap(diagramProblems));
		const keys = new Set(sources.flatMap(marksOf));
		const names = /legend=\{\{([\s\S]*?)\}\}/.exec(attributes)?.[1] ?? '';
		const stray = [...names.matchAll(/(\w+):\s*['"]/g)].map((m) => m[1]).filter((key) => !keys.has(key));
		if (stray.length) report(match.index, [`the legend names ${stray.join(', ')}, which the picture does not use`]);
		if (tag === 'Compare') {
			if (sources.length !== 2) report(match.index, [`<Compare> has ${sources.length} pictures, not 2`]);
			const early = marksOf(sources[0] ?? '').filter((key) => OUTPUTS.has(key));
			if (early.length) report(match.index, [`the left picture has an output: ${early.join(', ')}`]);
		}
	}
	return problems;
}
