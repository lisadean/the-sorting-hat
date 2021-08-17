// const labels = {
// 	XS: {
// 		name: 'size/XS',
// 		lines: 0,
// 		color: '3CBF00'
// 	},
// 	S: {
// 		name: 'size/S',
// 		lines: 10,
// 		color: '5D9801'
// 	},
// 	M: {
// 		name: 'size/M',
// 		lines: 30,
// 		color: '7F7203'
// 	},
// 	L: {
// 		name: 'size/L',
// 		lines: 100,
// 		color: 'A14C05'
// 	},
// 	XL: {
// 		name: 'size/XL',
// 		lines: 500,
// 		color: 'C32607'
// 	},
// 	XXL: {
// 		name: 'size/XXL',
// 		lines: 1000,
// 		color: 'E50009'
// 	}
// };

// const convertObjectToArray = (object) => {
// 	if (typeof object === 'object') {
// 		let a = Object.entries(labels);
// 		a.map(([key, value]) => {
// 			return convertObjectToArray(
// 	}
// };
// const labelArray = convertObjectToArray(labels);
// console.log(labelArray[0]);
var minimatch = require('minimatch');

minimatch('bar.foo', '*.foo'); // true!
const serverOnlyPattern = '**/src/server/**';
const files = ['test/fixtures/2000lines.mocks.ts', 'src/server/2000lines.mocks.ts'];
const serverOnly = files.some((file) => minimatch(file, serverOnlyPattern));
// console.log(minimatch(files[0], serverOnlyPattern));
console.log(serverOnly);
