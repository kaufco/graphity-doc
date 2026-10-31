// @ts-check
import starlight from '@astrojs/starlight';
import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { chapterProblems } from './src/lib/chapter-check.mjs';
import { closeMermaidBrowser, satteriMermaidHastPlugin, satteriMermaidPlugin } from './src/lib/mermaid.mjs';
import { AVAILABLE_LANGUAGES, LANGUAGES } from './src/lib/languages.mjs';
import { BASE, SITE } from './src/lib/site.mjs';
import { guideStructure } from './src/lib/structure.mjs';

const guideRoot = fileURLToPath(new URL('.', import.meta.url));

// The look: 'primer', the look of the Graphity Javadoc (src/styles/primer.css), or 'starlight', the
// default look of Starlight - kept switchable while the look is being chosen.
const theme = process.env.GRAPHITY_GUIDE_THEME === 'starlight' ? 'starlight' : 'primer';

export default defineConfig({
	site: SITE,
	base: BASE,
	markdown: {
		// Sätteri is Astro's default Markdown processor. The Mermaid plugin takes ```mermaid blocks out
		// of the Markdown tree before Expressive Code turns code blocks into highlighted HTML.
		processor: satteri({ mdastPlugins: [satteriMermaidPlugin], hastPlugins: [satteriMermaidHastPlugin] }),
	},
	vite: {
		// src/lib/paths.mjs needs the guide directory also when it is bundled.
		define: { __GRAPHITY_GUIDE_ROOT__: JSON.stringify(guideRoot) },
	},
	integrations: [
		starlight({
			title: 'Solving Graph Problems with Graphity',
			// Long lines wrap, with their indentation kept, instead of scrolling sideways: the examples
			// are formatted to 100 columns, wider than the text column. Shell commands look like all
			// other code, not like a terminal window.
			expressiveCode: {
				defaultProps: { wrap: true, frame: 'code' },
				...(theme === 'primer' && {
					themes: ['github-light'],
					styleOverrides: { borderRadius: '6px', frames: { shadowColor: 'transparent' } },
				}),
			},
			customCss: ['./src/styles/guide.css', ...(theme === 'primer' ? ['./src/styles/primer.css'] : [])],
			components: {
				// Appends the "API used" section of the `api` frontmatter field to every page.
				MarkdownContent: './src/components/overrides/MarkdownContent.astro',
				// Puts the number of a chapter or problem page in front of its title.
				PageTitle: './src/components/overrides/PageTitle.astro',
				// The title at the left, the search at the right, and nothing else.
				Header: './src/components/overrides/Header.astro',
				// A plain symbol for the menu on a narrow screen, as for the search.
				MobileMenuToggle: './src/components/overrides/MobileMenuToggle.astro',
				// The language picker of the guide, above "On this page" and in the bar that stands in for it.
				PageSidebar: './src/components/overrides/PageSidebar.astro',
				MobileTableOfContents: './src/components/overrides/MobileTableOfContents.astro',
				MobileMenuFooter: './src/components/overrides/MobileMenuFooter.astro',
				// The light look only.
				ThemeProvider: './src/components/overrides/ThemeProvider.astro',
			},
			routeMiddleware: './src/route-middleware.ts',
			// The language of the guide (LanguagePicker), as html[data-language], set before the page is
			// painted; the style shows only the elements of that language (class lang-<key>), Java when no
			// language is set, and marks it in the picker. A link from outside names its language as
			// ?lang=<key>, as the READMEs and the API sites do; that then is the choice of the reader. A
			// value this build does not know counts as no value.
			head: [
				{
					tag: 'script',
					content: `(() => {
	const known = ${JSON.stringify(AVAILABLE_LANGUAGES.map((l) => l.key))};
	const storageKey = 'graphity-guide-language';
	let key = new URLSearchParams(location.search).get('lang');
	if (known.includes(key)) {
		try { localStorage.setItem(storageKey, key); } catch {}
	} else {
		key = null;
		try { key = localStorage.getItem(storageKey); } catch {}
	}
	document.documentElement.dataset.language = known.includes(key) ? key : known[0];
})();`,
				},
				{
					tag: 'style',
					content: LANGUAGES.flatMap((l, i) => [
						i === 0
							? `:root[data-language]:not([data-language='${l.key}']) .lang-${l.key} { display: none; }`
							: `:root:not([data-language='${l.key}']) .lang-${l.key} { display: none; }`,
						// An entry of "API used" without a counterpart in this language, or that repeats an earlier one
						// there (ApiUsed.astro).
						...(i === 0 ? [] : [`:root[data-language='${l.key}'] .api-hidden-${l.key} { display: none; }`]),
						// The selected entry of the language picker, as the current page in the navigation.
						`:root[data-language='${l.key}'] .language-option-${l.key} { color: var(--sl-color-white); font-weight: 600; background-color: var(--sl-color-gray-6); border-inline-start-color: var(--sl-color-accent); }`,
					]).join('\n'),
				},
			],
			// The order of the chapters and problems is in src/lib/structure.mjs; the sidebar lists them
			// with their numbers, the chapters as headings, between the pages outside the chapters.
			sidebar: [
				{ slug: 'index', label: 'Introduction' },
				{ slug: 'contents', label: 'Contents' },
				...guideStructure().flatMap((chapter) => [
					{
						slug: chapter.slug,
						label: `${chapter.number} ${chapter.title}`,
						attrs: { class: 'sidebar-chapter' },
					},
					...chapter.problems.map((problem) => ({
						slug: problem.slug,
						label: `${problem.number} ${problem.title}`,
						attrs: { class: 'sidebar-problem' },
					})),
				]),
				{ slug: 'api-index', label: 'Index by API' },
				{ slug: 'glossary', label: 'Glossary' },
			],
		}),
		{
			name: 'graphity-check-chapters',
			hooks: {
				'astro:build:done': ({ dir }) => {
					const problems = chapterProblems(fileURLToPath(dir));
					if (problems.length) throw new Error(`The chapters of the guide do not agree:\n  ${problems.join('\n  ')}`);
				},
			},
		},
		{
			name: 'graphity-mermaid-browser',
			hooks: {
				'astro:build:done': closeMermaidBrowser,
				'astro:server:done': closeMermaidBrowser,
			},
		},
	],
});
