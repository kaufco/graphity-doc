// The Java API of the published Graphity modules, read from their sources, and the API references
// used by <Api>, the `api` frontmatter field and the api-coverage script.
//
// Reference syntax (simple class names; nested types as Outer.Inner):
//   Sccs                          the class page
//   Components.sccsOf(Graph)      a method; parameter types by simple name, as in the source
//   Loops.of(BiAdjacentGraph, int) one overload of several
//   GraphBuilder.addPath(int...)  varargs as `int...`, arrays as `int[]`, type variables as `T[]`
//   GraphBuilder()                a constructor
//   Sccs.condense()               an inherited method: links to the declaring class (NodePartition)
//
// The parser is deliberately simple: it blanks out comments and literals, tracks braces, and reads the
// declaration heads at type-body level. scripts/check-javadoc-anchors.mjs checks its output against a
// locally built Javadoc.
import fs from 'node:fs';
import path from 'node:path';
import { guideRelative, requireJavaRoot } from './paths.mjs';

/** The modules whose API the guide documents and links. */
export const PUBLISHED_MODULES = ['graphity-core', 'graphity-controlflow', 'graphity-dot', 'graphity-mermaid'];

/** Where the Javadoc lives. The only place that knows; override with GRAPHITY_JAVADOC_URL. */
export function javadocBaseUrl() {
	const url = process.env.GRAPHITY_JAVADOC_URL || 'https://kaufco.github.io/graphity/';
	return url.endsWith('/') ? url : `${url}/`;
}

const PRIMITIVES = new Set(['boolean', 'byte', 'char', 'short', 'int', 'long', 'float', 'double', 'void']);

// Types that a signature can use without an import. Every other JDK or fastutil type (InputStream,
// IntList, IntFunction, ...) is resolved through the import declarations of the declaring file.
const JAVA_LANG = new Set([
	'Appendable', 'AutoCloseable', 'Boolean', 'Byte', 'CharSequence', 'Character', 'Class', 'Comparable',
	'Double', 'Enum', 'Float', 'Integer', 'Iterable', 'Long', 'Number', 'Object', 'Runnable', 'Short',
	'String', 'StringBuilder', 'Throwable', 'Void',
]);

const MODIFIERS = new Set([
	'public', 'protected', 'private', 'static', 'final', 'abstract', 'default', 'synchronized', 'native',
	'strictfp', 'sealed', 'non-sealed', 'transient', 'volatile',
]);

/** Methods every class has; never part of the coverage list. */
export const COMMON_OBJECT_METHODS = new Set(['equals', 'hashCode', 'toString']);

// ---------------------------------------------------------------------------------------------------
// Source scanning

/** Replaces comments and string, text-block and char literals by spaces, keeping line breaks. */
function blankOut(src) {
	let out = '';
	let i = 0;
	const blank = (s) => s.replace(/[^\n]/g, ' ');
	while (i < src.length) {
		const c = src[i];
		const d = src[i + 1];
		let end;
		if (c === '/' && d === '/') {
			end = src.indexOf('\n', i);
			if (end < 0) end = src.length;
		} else if (c === '/' && d === '*') {
			end = src.indexOf('*/', i + 2);
			end = end < 0 ? src.length : end + 2;
		} else if (c === '"' && src.startsWith('"""', i)) {
			end = i + 3;
			while (end < src.length && !src.startsWith('"""', end)) end += src[end] === '\\' ? 2 : 1;
			end += 3;
		} else if (c === '"' || c === "'") {
			end = i + 1;
			while (end < src.length && src[end] !== c && src[end] !== '\n') end += src[end] === '\\' ? 2 : 1;
			end += 1;
		} else {
			out += c;
			i++;
			continue;
		}
		out += blank(src.slice(i, end));
		i = end;
	}
	return out;
}

/** Removes annotations such as @Nullable or @SuppressWarnings("x"). */
function stripAnnotations(text) {
	let out = text;
	for (;;) {
		const m = /@(?!interface\b)[A-Za-z_$][\w$.]*/.exec(out);
		if (!m) return out;
		let end = m.index + m[0].length;
		const rest = out.slice(end);
		const args = /^\s*\(/.exec(rest);
		if (args) end = matchBracket(out, end + args[0].length - 1) + 1;
		out = `${out.slice(0, m.index)} ${out.slice(end)}`;
	}
}

/** Index of the bracket that closes the one at `open` (one of ( < [ {), or -1. */
function matchBracket(text, open) {
	const pairs = { '(': ')', '<': '>', '[': ']', '{': '}' };
	const o = text[open];
	const cl = pairs[o];
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		if (text[i] === o) depth++;
		else if (text[i] === cl && --depth === 0) return i;
	}
	return -1;
}

/** Splits at commas that are not nested in <>, () or []. */
function splitTopLevel(text) {
	const parts = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '<' || c === '(' || c === '[') depth++;
		else if (c === '>' || c === ')' || c === ']') depth--;
		else if (c === ',' && depth === 0) {
			parts.push(text.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(text.slice(start));
	return parts.map((p) => p.trim()).filter(Boolean);
}

/** Removes type arguments: `Map<String, List<T>>` -> `Map`. */
function eraseTypeArguments(type) {
	let out = '';
	let depth = 0;
	for (const c of type) {
		if (c === '<') depth++;
		else if (c === '>') depth--;
		else if (depth === 0) out += c;
	}
	return out;
}

/** Normalizes a parameter type as written: `final int @Nullable [] x` -> `int[]`, `IntFunction<T>` -> `IntFunction`. */
function normalizeType(type) {
	return eraseTypeArguments(stripAnnotations(type))
		.replace(/\bfinal\b/g, ' ')
		.replace(/\s+/g, '');
}

function parseParams(text, where) {
	return splitTopLevel(text).map((param) => {
		const p = stripAnnotations(param).replace(/\bfinal\b/g, ' ').replace(/\s+/g, ' ').trim();
		const m = /^(.*?)\s*([A-Za-z_$][\w$]*)((?:\s*\[\s*\])*)$/.exec(p);
		if (!m) throw new Error(`Cannot parse parameter "${param}" in ${where}`);
		return normalizeType(m[1] + m[3]);
	});
}

function parseTypeParams(text) {
	return splitTopLevel(text).map((tp) => stripAnnotations(tp).trim().split(/\s+/)[0]);
}

/** Parses a type declaration head, e.g. `public final class Sccs extends NodePartition`. */
function parseTypeHead(rawHead) {
	const head = stripAnnotations(rawHead).replace(/\s+/g, ' ').trim();
	const m = /(?:^|\s)(class|interface|enum|record|@interface) ([A-Za-z_$][\w$]*)/.exec(head);
	if (!m) return null;
	const modifiers = head.slice(0, m.index).trim().split(' ').filter(Boolean);
	if (!modifiers.every((mod) => MODIFIERS.has(mod))) return null;
	let rest = head.slice(m.index + m[0].length).trim();
	let typeParams = [];
	if (rest.startsWith('<')) {
		const end = matchBracket(rest, 0);
		typeParams = parseTypeParams(rest.slice(1, end));
		rest = rest.slice(end + 1).trim();
	}
	if (m[1] === 'record' && rest.startsWith('(')) rest = rest.slice(matchBracket(rest, 0) + 1).trim();
	const clause = (keyword) => {
		const c = new RegExp(`\\b${keyword} (.*?)(?= (?:extends|implements|permits) |$)`).exec(rest);
		return c ? splitTopLevel(c[1]).map(normalizeType) : [];
	};
	return {
		kind: m[1],
		simpleName: m[2],
		modifiers: new Set(modifiers),
		typeParams,
		supertypes: [...clause('extends'), ...clause('implements')],
	};
}

/** Parses a method or constructor head; returns null for fields, initializers and anything else. */
function parseMemberHead(rawHead, owner) {
	const head = stripAnnotations(rawHead).replace(/\s+/g, ' ').trim();
	const open = head.indexOf('(');
	if (open < 0) return null;
	const before = head.slice(0, open).trim();
	if (before.includes('=')) return null;
	const close = matchBracket(head, open);
	if (close < 0) return null;
	const after = head.slice(close + 1).trim();
	if (after && !/^throws [\w$.<>?, ]+$/.test(after) && !/^default\b/.test(after)) return null;
	const nameMatch = /([A-Za-z_$][\w$]*)$/.exec(before);
	if (!nameMatch) return null;
	const name = nameMatch[1];
	let rest = before.slice(0, nameMatch.index).trim();
	const modifiers = new Set();
	for (;;) {
		const mod = /^([a-z-]+)\b\s*/.exec(rest);
		if (!mod || !MODIFIERS.has(mod[1])) break;
		modifiers.add(mod[1]);
		rest = rest.slice(mod[0].length);
	}
	let typeParams = [];
	if (rest.startsWith('<')) {
		const end = matchBracket(rest, 0);
		if (end < 0) return null;
		typeParams = parseTypeParams(rest.slice(1, end));
		rest = rest.slice(end + 1).trim();
	}
	let kind;
	if (!rest) {
		if (name !== owner.simpleName) return null;
		kind = 'constructor';
	} else if (/^[\w$.]+(?:<.*>)?(?: ?\[ ?\])*$/.test(rest) && !['new', 'return', 'throw', 'else'].includes(rest)) {
		kind = 'method';
	} else {
		return null;
	}
	let visibility = ['public', 'protected', 'private'].find((v) => modifiers.has(v)) ?? 'package';
	if (visibility === 'package' && (owner.kind === 'interface' || owner.kind === '@interface')) visibility = 'public';
	return {
		kind,
		name,
		visibility,
		isStatic: modifiers.has('static'),
		typeParams,
		params: parseParams(head.slice(open + 1, close), `${owner.fqn}.${name}`),
	};
}

function parseFile(file, module) {
	const clean = blankOut(fs.readFileSync(file, 'utf8'));
	const pkg = /^\s*package\s+([\w.]+)\s*;/m.exec(clean)?.[1] ?? '';
	const imports = new Map();
	for (const m of clean.matchAll(/^\s*import\s+(static\s+)?([\w.$]+)\s*;/gm)) {
		if (!m[1]) imports.set(m[2].slice(m[2].lastIndexOf('.') + 1), m[2]);
	}
	const types = [];
	const stack = []; // one frame per open brace: { type } for type bodies, { type: null } otherwise
	let head = '';
	let parens = 0;
	for (const ch of clean) {
		const top = stack.at(-1);
		const atTypeLevel = !top || top.type;
		if (!atTypeLevel) {
			if (ch === '{') stack.push({ type: null });
			else if (ch === '}') stack.pop();
			continue;
		}
		if (parens > 0 || (ch !== '{' && ch !== '}' && ch !== ';')) {
			if (ch === '(') parens++;
			else if (ch === ')') parens--;
			head += ch;
			continue;
		}
		if (ch === '{') {
			const decl = parseTypeHead(head);
			if (decl) {
				const outer = top?.type ?? null;
				const name = outer ? `${outer.name}.${decl.simpleName}` : decl.simpleName;
				let visibility = ['public', 'protected', 'private'].find((v) => decl.modifiers.has(v)) ?? 'package';
				if (visibility === 'package' && outer && outer.kind === 'interface') visibility = 'public';
				const type = {
					module,
					file,
					pkg,
					imports,
					outer,
					name,
					simpleName: decl.simpleName,
					fqn: pkg ? `${pkg}.${name}` : name,
					kind: decl.kind,
					visibility,
					typeParams: decl.typeParams,
					// Nested enums, records and interfaces, and all members of interfaces, are implicitly static.
					isStatic: decl.modifiers.has('static') || decl.kind !== 'class' || outer?.kind === 'interface',
					supertypes: decl.supertypes,
					members: [],
					page: `${pkg.replaceAll('.', '/')}/${name}.html`,
				};
				type.published = visibility === 'public' || (outer?.published && visibility === 'protected');
				type.published &&= !outer || outer.published;
				if (decl.kind === 'enum') {
					type.members.push(
						{ kind: 'method', name: 'values', visibility: 'public', isStatic: true, typeParams: [], params: [], implicit: true },
						{ kind: 'method', name: 'valueOf', visibility: 'public', isStatic: true, typeParams: [], params: ['String'], implicit: true },
					);
				}
				types.push(type);
				stack.push({ type });
			} else {
				if (top) addMember(top.type, head);
				stack.push({ type: null });
			}
		} else if (ch === '}') {
			stack.pop();
		} else if (top) {
			addMember(top.type, head);
		}
		head = '';
	}
	return types;
}

function addMember(owner, head) {
	const member = parseMemberHead(head, owner);
	if (member) owner.members.push(member);
}

// ---------------------------------------------------------------------------------------------------
// The index

let cachedIndex;

/** All types of the published modules, parsed once per process. */
export function javaApi() {
	cachedIndex ??= buildIndex();
	return cachedIndex;
}

function listJavaFiles(dir) {
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((e) => e.isFile() && e.name.endsWith('.java') && e.name !== 'package-info.java' && e.name !== 'module-info.java')
		.map((e) => path.join(e.parentPath, e.name))
		.sort();
}

function buildIndex() {
	const types = [];
	for (const module of PUBLISHED_MODULES) {
		const dir = path.join(requireJavaRoot(), module, 'src', 'main', 'java');
		const files = listJavaFiles(dir);
		if (files.length === 0) throw new Error(`No Java sources found in ${guideRelative(dir)}`);
		for (const file of files) types.push(...parseFile(file, module));
	}
	const byFqn = new Map(types.map((t) => [t.fqn, t]));
	const published = types.filter((t) => t.published);
	const byName = new Map();
	const add = (key, t) => byName.set(key, [...(byName.get(key) ?? []), t]);
	for (const t of published) {
		add(t.name, t);
		if (t.outer) add(t.simpleName, t);
	}
	return { types, published, byFqn, byName };
}

/** Resolves a type name as written in the source of `owner` to its fully qualified name. */
function qualifyTypeName(name, owner, index) {
	if (/^[a-z]/.test(name)) return name; // already qualified
	const [first, ...rest] = name.split('.');
	const join = (fqn) => [fqn, ...rest].join('.');
	for (let t = owner; t; t = t.outer) {
		if (t.simpleName === first) return join(t.fqn);
		const nested = index.byFqn.get(`${t.fqn}.${first}`);
		if (nested) return join(nested.fqn);
	}
	if (owner.imports.has(first)) return join(owner.imports.get(first));
	const samePackage = index.byFqn.get(`${owner.pkg}.${first}`);
	if (samePackage) return join(samePackage.fqn);
	if (JAVA_LANG.has(first)) return join(`java.lang.${first}`);
	return null;
}

function isTypeVariable(name, member, owner) {
	if (member.typeParams.includes(name)) return true;
	for (let t = owner; t; t = t.isStatic ? null : t.outer) if (t.typeParams.includes(name)) return true;
	return false;
}

/** The fragment of a member in the JDK 25 Javadoc, e.g. `of(com.kobayami.graphity.BiAdjacentGraph,int)`. */
export function javadocAnchor(member, owner, index = javaApi()) {
	const params = member.params.map((p) => {
		const [, base, suffix] = /^(.*?)((?:\[\])*(?:\.\.\.)?)$/.exec(p);
		if (PRIMITIVES.has(base) || isTypeVariable(base, member, owner)) return p;
		const fqn = qualifyTypeName(base, owner, index);
		if (!fqn) {
			throw new Error(
				`Cannot resolve the parameter type ${base} of ${owner.fqn}.${member.name}: ` +
					'neither imported, in the same package, nor in java.lang (see JAVA_LANG in guide/src/lib/java-api.mjs)',
			);
		}
		return fqn + suffix;
	});
	return `${member.kind === 'constructor' ? '<init>' : member.name}(${params.join(',')})`;
}

/** The published supertypes of a type, nearest first (the type itself first). */
function typeAndSupertypes(type, index) {
	const result = [];
	const queue = [type];
	while (queue.length) {
		const t = queue.shift();
		if (result.includes(t)) continue;
		result.push(t);
		for (const s of t.supertypes) {
			const fqn = qualifyTypeName(s, t, index);
			const st = fqn && index.byFqn.get(fqn);
			if (st) queue.push(st);
		}
	}
	return result;
}

/** Whether a member appears in the Javadoc (and may be linked). */
function isDocumented(member) {
	return member.visibility === 'public' || member.visibility === 'protected';
}

/** `Loops.of(BiAdjacentGraph, int)`-style display of a member. */
export function memberSignature(type, member) {
	const name = member.kind === 'constructor' ? type.name : `${type.name}.${member.name}`;
	return `${name}(${member.params.join(', ')})`;
}

// ---------------------------------------------------------------------------------------------------
// References

/** Splits `Components.sccsOf(Graph)` into its parts, or throws. */
export function parseRef(ref) {
	const m = /^\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*(?:\((.*)\))?\s*$/s.exec(String(ref));
	if (!m) throw new Error(`Malformed API reference "${ref}"; expected e.g. Sccs, Components.sccsOf(Graph) or GraphBuilder()`);
	return {
		path: m[1],
		params: m[2] === undefined ? null : splitTopLevel(m[2]).map(normalizeType),
	};
}

function findType(name, index) {
	if (/^[a-z]/.test(name)) {
		const t = index.byFqn.get(name);
		return t?.published ? [t] : [];
	}
	return index.byName.get(name) ?? [];
}

function lastSegment(type) {
	return type.replace(/^(?:[\w$]+\.)*/, '');
}

function sameParams(a, b) {
	return a.length === b.length && a.every((p, i) => lastSegment(p) === lastSegment(b[i]));
}

/**
 * Resolves an API reference. Returns
 * `{ kind, type, member, declaringType, url, label, signature, coverageKey }` or throws an Error whose
 * message says what is wrong and what would be valid.
 */
export function resolveRef(ref, index = javaApi()) {
	const fail = (msg) => {
		throw new Error(`Unresolvable API reference "${ref}": ${msg}`);
	};
	const { path: refPath, params } = parseRef(ref);
	const asType = findType(refPath, index);
	if (asType.length > 1) fail(`ambiguous type, use one of ${asType.map((t) => t.fqn).join(', ')}`);

	if (params === null) {
		if (asType.length === 0) {
			const dot = refPath.lastIndexOf('.');
			const hint = dot > 0 && findType(refPath.slice(0, dot), index).length ? ` (a method needs its parameter list, e.g. ${refPath}())` : '';
			fail(`no public type ${refPath} in ${PUBLISHED_MODULES.join(', ')}${hint}`);
		}
		const type = asType[0];
		return {
			kind: 'type',
			type,
			member: null,
			declaringType: type,
			url: javadocBaseUrl() + type.page,
			label: refPath,
			signature: refPath,
			coverageKey: null,
		};
	}

	let type;
	let memberName;
	let typeLabel;
	if (asType.length === 1) {
		type = asType[0];
		memberName = null; // constructor
		typeLabel = refPath;
	} else {
		const dot = refPath.lastIndexOf('.');
		if (dot < 0) fail(`no public type ${refPath} (constructors are written as Type(...), methods as Type.method(...))`);
		typeLabel = refPath.slice(0, dot);
		memberName = refPath.slice(dot + 1);
		const owners = findType(typeLabel, index);
		if (owners.length > 1) fail(`ambiguous type ${typeLabel}, use one of ${owners.map((t) => t.fqn).join(', ')}`);
		if (owners.length === 0) fail(`no public type ${typeLabel} in ${PUBLISHED_MODULES.join(', ')}`);
		type = owners[0];
	}

	const searchTypes = memberName === null ? [type] : typeAndSupertypes(type, index);
	const candidates = [];
	for (const t of searchTypes) {
		for (const m of t.members) {
			const isCandidate = memberName === null ? m.kind === 'constructor' : m.kind === 'method' && m.name === memberName;
			if (isCandidate && isDocumented(m)) candidates.push({ t, m });
		}
	}
	const what = memberName === null ? `constructor of ${type.name}` : `method ${memberName} in ${type.name}`;
	if (candidates.length === 0) fail(`no public or protected ${what}${searchTypes.length > 1 ? ' or its supertypes' : ''}`);
	// The nearest declaration wins (an override hides the inherited method).
	const match = candidates.find(({ m }) => sameParams(m.params, params));
	if (!match) {
		const overloads = [...new Set(candidates.map(({ t, m }) => memberSignature(t, m)))];
		fail(`no ${what} with parameters (${params.join(', ')}); declared: ${overloads.join('; ')}`);
	}
	const { t: declaringType, m: member } = match;
	const anchor = javadocAnchor(member, declaringType, index);
	return {
		kind: member.kind,
		type,
		member,
		declaringType,
		url: `${javadocBaseUrl()}${declaringType.page}#${encodeURI(anchor)}`,
		label: memberName === null ? `new ${typeLabel}` : `${typeLabel}.${memberName}`,
		signature: memberName === null ? `${typeLabel}(${params.join(', ')})` : `${typeLabel}.${memberName}(${params.join(', ')})`,
		coverageKey: coverageKey(declaringType, member),
	};
}

/** Identifies a member for the coverage count: overloads share one key. */
export function coverageKey(type, member) {
	return `${type.fqn}#${member.kind === 'constructor' ? '<init>' : member.name}`;
}
