// Locations shared by the site build and the Node scripts in scripts/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* global __GRAPHITY_GUIDE_ROOT__ */

/**
 * The guide directory (where package.json lives). During the Astro build this file is bundled, so
 * import.meta.url no longer points here; astro.config.mjs therefore inlines the directory as
 * __GRAPHITY_GUIDE_ROOT__. Plain Node scripts fall back to this file's own location.
 */
export const guideRoot =
	typeof __GRAPHITY_GUIDE_ROOT__ === 'string'
		? __GRAPHITY_GUIDE_ROOT__
		: fileURLToPath(new URL('../..', import.meta.url));

/**
 * The Java library the guide documents: the directory GRAPHITY_JAVA_ROOT names, relative to the guide
 * directory, or else languages/java, where `npm run languages` checks out the version that
 * languages.json names. The pages show its examples and resolve their API references against its
 * sources.
 */
export const javaRoot = path.resolve(guideRoot, process.env.GRAPHITY_JAVA_ROOT || path.join('languages', 'java'));

/** javaRoot, or an Error that says how to get it. */
export function requireJavaRoot() {
	if (!fs.existsSync(javaRoot)) {
		throw new Error(
			`The Java library is missing at ${guideRelative(javaRoot)}: run \`npm run languages\`, ` +
				'or set GRAPHITY_JAVA_ROOT to a checkout of kaufco/graphity.',
		);
	}
	return javaRoot;
}

/** The content pages of the site. */
export const docsDir = path.join(guideRoot, 'src', 'content', 'docs');

/** Path relative to the guide directory, with forward slashes, for messages. */
export function guideRelative(file) {
	return path.relative(guideRoot, file).split(path.sep).join('/');
}
