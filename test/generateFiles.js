const { writeFile, writeFileSync } = require('fs');
const { join } = require('path');
const { exec } = require('child_process');
/* eslint-disable no-console */

// Usage: node ./test/generateFiles.js <number of lines to add> <create as mock?> <server file?> <commit and push?>
// Example: node ./test/generateFiles.js 31 yes yes no
// a file called 31lines.mock.txt will be generated in the server directory but will not be committed and pushed

const lineCount = process.argv[2];
const excludedFile = process.argv[3];
const serverFile = process.argv[4];
const commitAndPush = process.argv[5];

const generatedFileDirectory = serverFile === 'yes' ? join(__dirname, '..', 'src', 'server') : join(__dirname, '..', 'test', 'pr');

let stuff = '';
for (let i = 0; i < Number(lineCount); i++) {
	stuff += `${i + 1}${i < Number(lineCount) - 1 ? `\n` : ''}`;
}
const fileName = excludedFile === 'yes' ? `${lineCount}lines.mock.ts` : `${lineCount}lines.txt`;
const filePath = join(generatedFileDirectory, fileName);
console.log(filePath);

if (commitAndPush === 'yes') {
	writeFile(filePath, stuff, null, () =>
		exec(`git add ${filePath}; git commit --no-verify -m '${lineCount}${excludedFile && ' mock'}'; git push`, (error, stdout, stderr) =>
			console.log('error: ', error, '/nstdout: ', stdout, '/nstderr: ', stderr)
		)
	);
} else {
	writeFileSync(filePath, stuff);
}
