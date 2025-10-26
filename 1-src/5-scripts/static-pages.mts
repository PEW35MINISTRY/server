/**
 * Static HTML Page Build Script
 * -------------------------------------
 * This script copies all `.html` files from:
 *     ./1-src/0-assets/static-pages/
 * into:
 *     ./0-compiled/0-assets/static-pages/
 *
 * During the process, it replaces all instances of `{{ASSET_URL}}` in the HTML
 * content with the value of the `ASSET_URL` environment variable.
 * 
 * Usage: Run during build. Make sure ASSET_URL is set.
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import path from 'path';
import { getEnvironment } from '../2-services/10-utilities/utilities.mjs';
import { ENVIRONMENT_TYPE } from '../0-assets/field-sync/input-config-sync/inputField.mjs';

//Assets must be hosted in AWS CDN for non-local environments
if(!(process.env.ASSET_URL) && getEnvironment() !== ENVIRONMENT_TYPE.LOCAL) {
  throw new Error(`Missing required ${getEnvironment()} environment variable: ASSET_URL`);
}

const ASSET_URL = process.env.ASSET_URL || 'http://localhost:3000/assets';
const ENVIRONMENT_BASE_URL = process.env.ENVIRONMENT_BASE_URL || 'http://localhost:5000';

//Relative Paths from /0-compiled/5-scripts/
const SOURCE_DIRECTORY = path.join('.', '1-src', '0-assets', 'static-pages');
const COMPILED_DIRECTORY = path.join('.', '0-compiled', '0-assets', 'static-pages');

//Copies HTML files to /compiled and replaces {{ASSET_URL}}
const processHtmlFiles = async(src:string, dest:string) => {
  try {
    const entries = await readdir(src, { withFileTypes: true });

    await mkdir(dest, { recursive: true });

    for(const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      const fileStat = await stat(srcPath);

      if(fileStat.isDirectory()) {
        await processHtmlFiles(srcPath, destPath); // Recursive call
      } else if (entry.name.endsWith('.html')) {
        let content = await readFile(srcPath, 'utf-8');

        content = content.replace(/{{ASSET_URL}}/g, ASSET_URL);
        content = content.replace(/{{ENVIRONMENT_BASE_URL}}/g, ENVIRONMENT_BASE_URL);

        await writeFile(destPath, content, 'utf-8');
        console.log(`✓ Static Page: ${entry.name}`);
      }
    }
  } catch (err) {
    throw new Error(`Failed processing HTML files: ${err}`);
  }
}

// Run script
processHtmlFiles(SOURCE_DIRECTORY, COMPILED_DIRECTORY).catch(err => {
  console.error(err);
  process.exit(1);
});
