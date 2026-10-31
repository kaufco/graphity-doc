// Checks the source parser of src/lib/java-api.mjs against a locally built Javadoc: every public or
// protected method and constructor must have exactly the anchor that javadoc generated, and every
// method or constructor in the Javadoc must be known to the parser.
//
// Build the Javadoc first, in the Java library (src/lib/paths.mjs, javaRoot):
//   mvn -B -ntp -pl graphity-core,graphity-controlflow,graphity-dot,graphity-mermaid,graphity,graphity-bom -am javadoc:aggregate
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { javaApi, javadocAnchor, memberSignature } from '../src/lib/java-api.mjs';
import { requireJavaRoot } from '../src/lib/paths.mjs';

const apidocs = path.join(requireJavaRoot(), 'target', 'reports', 'apidocs');
const indexFile = path.join(apidocs, 'member-search-index.js');
if (!fs.existsSync(indexFile)) {
	console.error(`No Javadoc at ${apidocs}. Build it first, see the comment at the top of this script.`);
	process.exit(2);
}

const sandbox = { updateSearchResults() {} };
vm.runInNewContext(fs.readFileSync(indexFile, 'utf8'), sandbox);
const javadoc = new Set(
	sandbox.memberSearchIndex.filter((e) => e.l.includes('(')).map((e) => `${e.p}.${e.c}#${decodeURI(e.u ?? e.l)}`),
);

const index = javaApi();
const ours = new Set();
let problems = 0;
for (const type of index.published) {
	for (const member of type.members) {
		if (member.visibility !== 'public' && member.visibility !== 'protected') continue;
		const key = `${type.fqn}#${javadocAnchor(member, type, index)}`;
		ours.add(key);
		if (!javadoc.has(key)) {
			problems++;
			console.log(`not in the Javadoc: ${memberSignature(type, member)} -> ${key}`);
		}
	}
}
for (const key of javadoc) {
	if (!ours.has(key)) {
		problems++;
		console.log(`missed by the parser: ${key}`);
	}
}
console.log(`${ours.size} members checked against ${javadoc.size} Javadoc entries, ${problems} problems`);
process.exit(problems ? 1 : 0);
