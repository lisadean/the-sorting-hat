const fs = require('fs');
const path = require('path');

const lineCount = process.argv[2];

let stuff = '';
for (let i = 0; i < lineCount; i++) {
	stuff += `${i + 1}${i < lineCount - 1 ? `\n` : ''}`;
}
const fileName = path.join(__dirname, 'fixtures', `${lineCount}lines.txt`);

fs.writeFileSync(fileName, stuff);
