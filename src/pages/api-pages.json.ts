// /api-pages.json: which pages of the guide use which part of the API, for links from the API
// documentation back to the guide. The API documentation of a library reads it when it is deployed
// and adds the links to its generated pages, so that the library's sources stay independent of the
// guide. From the `api` frontmatter of the pages, as the index by API.
//
// "guide" is the address of the guide; "pages" has the number and title of each page that uses the
// API, by its path relative to "guide"; each language of the build maps the page and anchor of an
// API element in its API documentation (relative to its root; the anchor as the element's id) to the
// paths of the pages that use it, in the order of their numbers.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { javadocBaseUrl, resolveRef } from '../lib/java-api.mjs';
import { portTargets } from '../lib/lang-api.mjs';
import { PORTS } from '../lib/languages.mjs';
import { BASE, SITE } from '../lib/site.mjs';
import { pageNumbers } from '../lib/structure.mjs';

/** `Graph.html#outNodes(int)` for a link into the API documentation at `root`. */
function target(url: string, root: string) {
	const [page, anchor] = url.slice(root.length).split('#');
	return anchor === undefined ? page : `${page}#${decodeURI(anchor)}`;
}

export const GET: APIRoute = async () => {
	const numbers = pageNumbers();
	const pages: Record<string, { number: string; title: string }> = {};
	const languages: Record<string, Map<string, Set<string>>> = { java: new Map() };
	for (const language of PORTS) languages[language.key] = new Map();
	const add = (key: string, element: string, page: string) => {
		const map = languages[key];
		if (!map.has(element)) map.set(element, new Set());
		map.get(element)!.add(page);
	};

	for (const entry of await getCollection('docs')) {
		const refs = entry.data.api ?? [];
		if (refs.length === 0) continue;
		const page = `${entry.id}/`;
		pages[page] = { number: numbers.get(entry.id) ?? '', title: entry.data.title };
		for (const ref of refs) {
			add('java', target(resolveRef(ref).url, javadocBaseUrl()), page);
			portTargets(ref).forEach((port, i) => {
				if (port.url) add(port.key, target(port.url, PORTS[i].apiDocs), page);
			});
		}
	}

	const byNumber = (a: string, b: string) => pages[a].number.localeCompare(pages[b].number, 'en', { numeric: true });
	const json = {
		guide: new URL(BASE, SITE).href,
		pages,
		...Object.fromEntries(
			Object.entries(languages).map(([key, map]) => [
				key,
				Object.fromEntries([...map].sort(([a], [b]) => (a < b ? -1 : 1)).map(([element, set]) => [element, [...set].sort(byNumber)])),
			]),
		),
	};
	return new Response(JSON.stringify(json, null, '\t'), { headers: { 'Content-Type': 'application/json' } });
};
