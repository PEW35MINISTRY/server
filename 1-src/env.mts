/**********************************************************************************************
 * Reasoning for env.mjs EXISTS AND MUST BE IMPORTED FIRST
 *
 * ES modules evaluate the entire import graph before executing module code.
 * If any module reads process.env at the top level, and dotenv has not run yet,
 * those values will be undefined and can cause runtime failures.
 *
 * Example of the problem:
 *   export const PRINT_LOGS_TO_CONSOLE =
 *     (process.env.ENVIRONMENT === ENVIRONMENT_TYPE.LOCAL) ? true : false;
 *
 * This executes during module evaluation, before dotenv runs, so ENVIRONMENT
 * was undefined.
 * 
 * Placing dotenv in a dedicated env.mjs file and importing it first in server.mjs guarantees
 * environment variables are initialized exactly once before the app loads.
 *
 * See: https://stackoverflow.com/questions/42817339/es6-import-happening-before-env-import
 **********************************************************************************************/

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

//ENV loads from root of project
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

//Evaluate required Environment Variables
import verifyEnvironmentVariables from './5-scripts/env-verification.mjs';
verifyEnvironmentVariables();
