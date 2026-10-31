// Runs `astro dev` or `astro build` with the API links pointing to local copies of the API
// documentation, for reviewing the guide without the published sites.
// Usage: npm run dev:local-javadoc | npm run build:local-javadoc
//
// For each language of the build (src/lib/languages.mjs), copies the API documentation that its own
// build put into `localApiDocs` of its library to public/api/<key>/ (gitignored), and points the links
// there. Build the documentation first, in each library:
//   Java:       mvn -B -ntp -pl graphity-core,graphity-controlflow,graphity-dot,graphity-mermaid,graphity,graphity-bom -am javadoc:aggregate
//   the ports:  the command "docCommand" in the API mapping of the port ("apiMap" in src/lib/languages.mjs)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AVAILABLE_LANGUAGES } from '../src/lib/languages.mjs';
import { guideRelative, guideRoot, requireJavaRoot } from '../src/lib/paths.mjs';
import { BASE } from '../src/lib/site.mjs';

const command = process.argv[2];
if (command !== 'dev' && command !== 'build') {
	console.error('Usage: node scripts/local-javadoc.mjs dev|build');
	process.exit(2);
}
requireJavaRoot();

const env = { ...process.env };
for (const language of AVAILABLE_LANGUAGES) {
	const docs = path.join(language.root, language.localApiDocs);
	if (!fs.existsSync(docs)) {
		console.error(`No ${language.label} API documentation in ${docs}. Build it in the library first.`);
		process.exit(1);
	}
	const target = path.join(guideRoot, 'public', 'api', language.key);
	fs.rmSync(target, { recursive: true, force: true });
	fs.cpSync(docs, target, { recursive: true });
	console.log(`Copied the ${language.label} API documentation to ${guideRelative(target)}/`);
	if (language.key === 'java') env.GRAPHITY_JAVADOC_URL = `${BASE}api/java/`;
	else env[`GRAPHITY_${language.key.toUpperCase()}_API_URL`] = `${BASE}api/${language.key}/`;
}

const astro = path.join(guideRoot, 'node_modules', 'astro', 'bin', 'astro.mjs');
const result = spawnSync(process.execPath, [astro, command], {
	cwd: guideRoot,
	stdio: 'inherit',
	env,
});
process.exit(result.status ?? 1);
