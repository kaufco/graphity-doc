// Checks out the libraries the guide documents, each at the version languages.json names, into
// languages/<key>/ (gitignored): `npm run languages`. A checkout that is already at that version is
// kept; one at another version is replaced. GRAPHITY_<KEY>_ROOT, if set, makes the build use another
// directory for that language instead (src/lib/languages.mjs), and then nothing is checked out for it.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { rootVariable } from '../src/lib/languages.mjs';
import { guideRelative, guideRoot } from '../src/lib/paths.mjs';

const languages = JSON.parse(fs.readFileSync(path.join(guideRoot, 'languages.json'), 'utf8'));

for (const [key, { repository, ref }] of Object.entries(languages)) {
	const variable = rootVariable(key);
	if (process.env[variable]) {
		console.log(`${key}: ${variable} is set, nothing to check out`);
		continue;
	}
	const dir = path.join(guideRoot, 'languages', key);
	if (fs.existsSync(dir)) {
		let at = null;
		try {
			at = execFileSync('git', ['-C', dir, 'describe', '--tags', '--exact-match', 'HEAD'], {
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'ignore'],
			}).trim();
		} catch {}
		if (at === ref) {
			console.log(`${key}: ${guideRelative(dir)} is at ${ref}`);
			continue;
		}
		fs.rmSync(dir, { recursive: true, force: true });
	}
	console.log(`${key}: checking out ${repository} at ${ref} into ${guideRelative(dir)}`);
	try {
		execFileSync(
			'git',
			['-c', 'advice.detachedHead=false', 'clone', '--quiet', '--depth', '1', '--branch', ref, `https://github.com/${repository}.git`, dir],
			{ stdio: 'inherit' },
		);
	} catch {
		console.error(`${key}: could not check out ${repository} at ${ref} - is ${ref} a tag or branch there?`);
		process.exit(1);
	}
}
