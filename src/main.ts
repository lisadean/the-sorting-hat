require('dotenv').config();
const { run } = require('probot');
const app = require('./index');

run(app);
