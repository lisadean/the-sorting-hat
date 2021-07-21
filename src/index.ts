require('dotenv').config();
import { run } from 'probot';
import app from './app';

// This is used to run this app in development or as a deployed app

run(app);
