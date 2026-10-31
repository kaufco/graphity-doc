import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				/**
				 * The API a page uses, in the reference syntax of <Api> (e.g. "Components.sccsOf(Graph)").
				 * Rendered as the "API used" section at the end of the page and counted by api-coverage.
				 */
				api: z.array(z.string()).optional(),
			}),
		}),
	}),
};
