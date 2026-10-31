// Mermaid diagrams rendered to inline SVG at build time, so no Mermaid JavaScript reaches the browser.
//
// Every ```mermaid block is rendered with Mermaid's "default" theme, in a headless Chromium
// (Playwright), and the SVG goes into the page. Nodes with a fill but no text color get black or white
// text, whichever contrasts better.
//
// Rendered SVGs are cached in node_modules/.cache/graphity-mermaid, keyed by source, configuration,
// Mermaid version and src/lib/diagram-layout.js, which refines each drawing, so warm builds start no
// browser at all.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marksOf, pictureProblems } from './legend.mjs';
import { guideRoot } from './paths.mjs';

const require = createRequire(import.meta.url);
const mermaidScript = require.resolve('mermaid/dist/mermaid.min.js');
const mermaidVersion = require('mermaid/package.json').version;
const layoutScript = path.join(guideRoot, 'src', 'lib', 'diagram-layout.js');
const cacheDir = path.join(guideRoot, 'node_modules', '.cache', 'graphity-mermaid');

// Bump when the output format below changes, to invalidate cached SVGs.
const FORMAT_VERSION = 6;

const BASE_CONFIG = {
	startOnLoad: false,
	securityLevel: 'strict',
	// Arial is measured with its metric clone Liberation Sans on Linux, so labels fit on all systems.
	fontFamily: 'arial, sans-serif',
	// Plain SVG text instead of HTML in <foreignObject>: the page's CSS cannot reach into the labels.
	htmlLabels: false,
	// Mermaid 12 widens every node to at least 120px; graph nodes often have one-character labels.
	// Room between the title of a frame (subgraph) and its nodes; the title moves to the left edge of
	// the frame (see alignClusterLabels), away from the edges that enter the frame in its middle.
	// Node labels stay on one line.
	flowchart: { htmlLabels: false, minNodeWidth: 0, wrappingWidth: 500, subGraphTitleMargin: { top: 4, bottom: 6 } },
};

// A wide diagram shrinks to the content width, but not below this share of its natural size; beyond
// that it scrolls horizontally, so its labels stay readable.
const MIN_SCALE = 0.7;

// No background on the labels of edges: it would show as a rectangle on a frame; diagram-layout.js
// outlines them instead.
const CONFIG = { ...BASE_CONFIG, theme: 'default', themeCSS: '.edgeLabel rect{fill:none;}' };

// ---------------------------------------------------------------------------------------------------
// Text colors

function hexToRgb(hex) {
	const h = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
	return [0, 2, 4, 6].map((i) => (i < h.length ? parseInt(h.slice(i, i + 2), 16) / 255 : undefined));
}

function relativeLuminance(hex) {
	const channel = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	const [r, g, b] = hexToRgb(hex).map(channel);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Gives classDef and style statements that set a hex fill but no text color the text color with the
 * better contrast, black or white. Otherwise the theme's dark text color applies, whatever the fill.
 */
export function addTextColors(source) {
	return source
		.split('\n')
		.map((line) => {
			if (!/^\s*(classDef|style)\b/.test(line) || /(^|[\s,;])color\s*:/.test(line)) return line;
			const fill = /(?:^|[\s,;])fill\s*:\s*#([0-9a-fA-F]{3,8})\b/.exec(line);
			if (!fill) return line;
			// Black wins over white above a relative luminance of 0.179 (WCAG contrast ratio).
			const text = relativeLuminance(fill[1]) > 0.179 ? '#000000' : '#ffffff';
			return line.replace(/\s*;?\s*$/, `,color:${text}`);
		})
		.join('\n');
}

// ---------------------------------------------------------------------------------------------------
// Rendering in Chromium

let session; // Promise<{ browser, page }>
let idleTimer;
let queue = Promise.resolve();

function openSession() {
	session ??= (async () => {
		const { chromium } = await import('playwright');
		let browser;
		try {
			browser = await chromium.launch();
		} catch (error) {
			session = undefined; // try again on the next render
			throw new Error(
				'Mermaid diagrams are rendered in Playwright\'s Chromium, which could not be started. ' +
					`Install it once with: npx playwright install --only-shell chromium\n${error.message}`,
			);
		}
		const page = await browser.newPage();
		await page.setContent('<!doctype html><html><head></head><body></body></html>');
		await page.addScriptTag({ path: mermaidScript });
		await page.addScriptTag({ path: layoutScript });
		return { browser, page };
	})();
	return session;
}

/** Closes the browser; the next render starts a new one. */
export async function closeMermaidBrowser() {
	clearTimeout(idleTimer);
	const current = session;
	session = undefined;
	if (current) {
		const { browser } = await current.catch(() => ({}));
		await browser?.close();
	}
}

async function renderInBrowser(source, config, id) {
	const { page } = await openSession();
	const result = await page.evaluate(
		async ({ source, config, id }) => {
			/* global mermaid, fitDiagram */
			mermaid.initialize(config);
			const holder = document.createElement('div');
			try {
				const { svg } = await mermaid.render(id, source);
				holder.innerHTML = svg;
				document.body.append(holder);
				fitDiagram(holder);
				return { svg: holder.innerHTML };
			} catch (error) {
				document.getElementById(id)?.remove();
				document.getElementById(`d${id}`)?.remove();
				return { error: String(error?.message ?? error) };
			} finally {
				holder.remove();
			}
		},
		{ source, config, id },
	);
	if (result.error) throw new Error(result.error);
	return result.svg;
}

/** Renders one diagram to an SVG string; renders run one at a time in a shared page. */
export function renderMermaid(source, id) {
	const key = crypto
		.createHash('sha256')
		.update(JSON.stringify({ FORMAT_VERSION, mermaidVersion, config: CONFIG, source, id, layout: fs.readFileSync(layoutScript, 'utf8') }))
		.digest('hex');
	const cacheFile = path.join(cacheDir, `${key}.svg`);
	if (fs.existsSync(cacheFile)) return Promise.resolve(fs.readFileSync(cacheFile, 'utf8'));
	const job = queue.then(async () => {
		clearTimeout(idleTimer);
		try {
			// Mermaid turns its entity codes (#58; for ":") into "&#58;", but with plain SVG text labels
			// that arrives escaped as text; unescape it so that the browser shows the character.
			const svg = (await renderInBrowser(source, CONFIG, id))
				.replace(/\s*\n\s*/g, ' ')
				.replace(/&amp;#(\d+);/g, '&#$1;');
			fs.mkdirSync(cacheDir, { recursive: true });
			fs.writeFileSync(cacheFile, svg);
			return svg;
		} finally {
			// Close the browser when no diagram has been rendered for a while (dev server).
			idleTimer = setTimeout(closeMermaidBrowser, 5000);
		}
	});
	queue = job.catch(() => {});
	return job;
}

/** Adds a min-width to Mermaid's `style="max-width: 1234px;"` on the root <svg>. */
function limitShrinking(svg) {
	return svg.replace(/^(<svg[^>]*style=")max-width: ([\d.]+)px;/, (_, start, width) => {
		return `${start}max-width: ${width}px; min-width: ${Math.round(width * MIN_SCALE)}px;`;
	});
}

/** The HTML for one diagram. */
export async function renderMermaidHtml(source, idBase) {
	// The code #58; for a colon, which the writers use, would count as text when Mermaid measures a label.
	const svg = limitShrinking(await renderMermaid(addTextColors(source).replaceAll('#58;', ':'), idBase));
	const arrows = /-->|-\.->|==>/.test(source);
	return `<div class="mermaid-diagram" data-marks="${marksOf(source).join(' ')}" data-arrows="${arrows}">${svg}</div>`;
}

// ---------------------------------------------------------------------------------------------------
// Markdown integration

const PLACEHOLDER = 'graphity-mermaid';

/**
 * Sätteri mdast plugin factory (one instance per document): renders ```mermaid code blocks and puts a
 * placeholder element in their place. It runs on the Markdown tree, before Expressive Code (a hast
 * plugin) looks at code blocks, so Expressive Code never sees the Mermaid source.
 */
export function satteriMermaidPlugin({ fileURL }) {
	const file = fileURL ? fileURLToPath(fileURL) : 'unknown file';
	const seen = new Map();
	let checked = false;
	return {
		name: 'graphity-mermaid',
		options: { position: true },
		async code(node, ctx) {
			if (node.lang !== 'mermaid') return undefined;
			if (fileURL && !checked) {
				checked = true;
				const problems = pictureProblems(fs.readFileSync(file, 'utf8'));
				if (problems.length) throw new Error(`Pictures of ${file} do not follow STYLE.md:\n  ${problems.join('\n  ')}`);
			}
			const hash = crypto.createHash('sha256').update(node.value).digest('hex').slice(0, 10);
			const count = seen.get(hash) ?? 0;
			seen.set(hash, count + 1);
			const idBase = `mermaid-${hash}${count ? `-${count}` : ''}`;
			let html;
			try {
				html = await renderMermaidHtml(node.value, idBase);
			} catch (error) {
				const line = node.position?.start?.line;
				throw new Error(`Mermaid diagram in ${file}${line ? `:${line}` : ''} failed to render: ${error.message}`);
			}
			ctx.data.graphityMermaid ??= {};
			ctx.data.graphityMermaid[idBase] = html;
			return { type: 'paragraph', data: { hName: PLACEHOLDER }, children: [{ type: 'text', value: idBase }] };
		},
	};
}

/**
 * Sätteri hast plugin: replaces the placeholders by the rendered SVGs as raw HTML. Raw HTML is
 * inserted verbatim, also in MDX, where Markdown parsing would otherwise touch the SVG's text
 * (for example, smart punctuation would curl the quotes in its CSS).
 */
export const satteriMermaidHastPlugin = {
	name: 'graphity-mermaid-svg',
	element: {
		filter: [PLACEHOLDER],
		visit(node, ctx) {
			const idBase = node.children.map((child) => child.value ?? '').join('');
			const html = ctx.data.graphityMermaid?.[idBase];
			if (!html) throw new Error(`Rendered Mermaid diagram ${idBase} is missing`);
			return { type: 'raw', value: html };
		},
	},
};
