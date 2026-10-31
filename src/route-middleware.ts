import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

// Lists the "API used" section (see src/components/ApiUsed.astro) in the table of contents.
export const onRequest = defineRouteMiddleware((context) => {
	const { entry, toc } = context.locals.starlightRoute;
	if (toc && entry.data.api?.length) {
		toc.items.push({ depth: 2, slug: 'api-used', text: 'API used', children: [] });
	}
});
