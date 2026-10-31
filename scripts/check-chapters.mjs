// Checks a finished build of the guide: the lists of chapters and problems, and the sentence that each
// page opens with (src/lib/chapter-check.mjs). The build makes the same check at its end.
//
//   npm run check-chapters
import path from 'node:path';
import { chapterProblems } from '../src/lib/chapter-check.mjs';

const problems = chapterProblems(path.resolve('dist'));
console.log(problems.join('\n') || 'The lists of chapters and the opening sentences agree.');
process.exit(problems.length ? 1 : 0);
