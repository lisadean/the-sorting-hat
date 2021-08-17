const fs = require('fs');
const path = require('path');
const child = require('child_process');

const lineCount = process.argv[2];

let stuff = '';
for (let i = 0; i < lineCount; i++) {
	stuff += `${i + 1}${i < lineCount - 1 ? `\n` : ''}`;
}
const fileName = path.join(__dirname, 'fixtures', `${lineCount}lines.txt`);
console.log(fileName);

fs.writeFile(fileName, stuff, null, () =>
	child.exec(`git add ${fileName}; git commit --no-verify -m '${lineCount}'; git push`, (error, stdout, stderr) =>
		console.log(`error: ${error} stdout: ${stdout} stderr: ${stderr}`)
	)
);
