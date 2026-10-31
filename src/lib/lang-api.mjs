// The counterparts of the Java API references in the other languages of the build, for <Api>, the
// "API used" section and the index by API: while a language is selected, they show its name and link
// into its API documentation instead of the Javadoc.
//
// Each port's examples carry the mapping, the file `apiMap` of src/lib/languages.mjs. It has one entry
// per public or protected type, constructor and method of the published Java modules, keyed by the
// ref of its declaration (`Graph`, `Graph.outNodes(int)`, `GraphBuilder()`; the syntax of
// src/lib/java-api.mjs, parameter types as in the Java source; see `canonicalRef`): "name", the name
// in that language, "url", its page and anchor relative to the root of the language's API
// documentation, optionally "signature", the name with its parameter list where the language keeps
// several overloads under the name, and optionally "note", what a reader of the Java text would not
// expect, shown as the link's tooltip. Where the language has no counterpart, "name" and "url" are
// null and "reason" says why. A page may write a ref in any form that resolves (an inherited method
// through the subclass, a nested type with its outer type); it is looked up by its declaration. A ref
// without an entry fails the build: each language of a build is shown in full.
import fs from 'node:fs';
import path from 'node:path';
import { javaApi, memberSignature, resolveRef } from './java-api.mjs';
import { guideRelative } from './paths.mjs';
import { PORTS } from './languages.mjs';

const maps = new Map();

function mapOf(language) {
	if (!maps.has(language.key)) {
		const file = path.join(language.root, language.apiMap);
		if (!fs.existsSync(file)) {
			throw new Error(`${language.label} is in the build, but its API mapping ${guideRelative(file)} does not exist`);
		}
		const { docRoot, refs } = JSON.parse(fs.readFileSync(file, 'utf8'));
		maps.set(language.key, { file, docRoot, refs });
	}
	return maps.get(language.key);
}

/** The key of a ref in the mappings: the ref of the declaration it resolves to. */
export function canonicalRef(ref) {
	const target = resolveRef(ref);
	return target.member ? memberSignature(target.declaringType, target.member) : target.type.name;
}

/**
 * The counterparts of a Java ref in the other languages of the build, in the order of the language
 * picker: { key, label, signature, url, note, reason } each, where label, signature and url are null
 * if the language has none. `label` and `signature` are in the form the text shows (`shortName`);
 * `signature` falls back to `label`.
 */
export function portTargets(ref) {
	if (PORTS.length === 0) return [];
	const key = canonicalRef(ref);
	return PORTS.map((language) => {
		const { file, refs } = mapOf(language);
		const entry = refs[key];
		if (!entry) throw new Error(`${key}${key === ref ? '' : ` (${ref})`} has no entry in ${guideRelative(file)}`);
		const name = entry.name ? language.shortName(entry.name) : null;
		return {
			key: language.key,
			label: name,
			signature: name && (entry.signature ? language.shortName(entry.signature) : name),
			url: name && entry.url ? language.apiDocs + entry.url : null,
			note: entry.note ?? null,
			reason: entry.reason ?? null,
		};
	});
}

/** The member's own name in a label: `DfsTraverser.run(int)` -> `run(int)`, `graphs::edge_mapping` -> `edge_mapping`. */
export const withoutOwner = (label) => {
	const open = label.indexOf('(');
	const head = open < 0 ? label : label.slice(0, open);
	const colons = head.lastIndexOf('::');
	return label.slice(Math.max(head.lastIndexOf('.') + 1, colons < 0 ? 0 : colons + 2));
};

/**
 * The text of a port's link where the Java text shows `javaLabel` for `target`: its name, as the
 * default Java label shows the class and the method; with the parameter list where `javaLabel` has one,
 * to tell overloads apart; and without the class where `javaLabel` names the method alone. Null if the
 * language has no counterpart.
 */
export function portLabel(port, javaLabel, target) {
	if (!port.label) return null;
	if (javaLabel === target.label) return port.label;
	const text = javaLabel.includes('(') ? port.signature : port.label;
	return /[.:]/.test(javaLabel.split('(')[0]) ? text : withoutOwner(text);
}

/** The keys every mapping has: each public or protected type, constructor and method, by its declaration. */
export function declarationRefs(index = javaApi()) {
	const refs = [];
	for (const type of index.published) {
		refs.push(type.name);
		for (const member of type.members) {
			if (member.implicit || (member.visibility !== 'public' && member.visibility !== 'protected')) continue;
			refs.push(memberSignature(type, member));
		}
	}
	return refs;
}

/**
 * What is wrong with a language's mapping: a docRoot other than the language's `localApiDocs`,
 * missing and unknown keys, entries without a name or a reason, a signature without a name.
 */
export function mappingProblems(language, index = javaApi()) {
	const { file, docRoot, refs } = mapOf(language);
	const where = guideRelative(file);
	const expected = new Set(declarationRefs(index));
	const problems = [];
	if (docRoot !== language.localApiDocs) {
		problems.push(`${where}: docRoot is "${docRoot}", but src/lib/languages.mjs has "${language.localApiDocs}"`);
	}
	for (const ref of expected) if (!refs[ref]) problems.push(`${where}: no entry for ${ref}`);
	for (const [ref, entry] of Object.entries(refs)) {
		if (!expected.has(ref)) problems.push(`${where}: ${ref} is not a declaration of the Java API`);
		else if (entry.name ? !entry.url : !entry.reason) {
			problems.push(`${where}: ${ref} needs ${entry.name ? 'a url' : 'a name and a url, or a reason'}`);
		} else if (entry.signature !== undefined && !(entry.name && typeof entry.signature === 'string' && entry.signature)) {
			problems.push(`${where}: ${ref} has a signature without a name, or an empty one`);
		}
	}
	return problems;
}
