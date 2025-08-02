import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';

/*****************************************
* Before build, saves latest git version *
******************************************/
const updateVariable = (content:string, key:string, value:string): string => {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`);
  } else {
    return content + `\n${key}=${value}`;
  }
};

let envContent = '';
if (existsSync('.env')) {
  envContent = readFileSync('.env', 'utf8');
}

const gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
const gitCommitHash = execSync('git rev-parse --short HEAD').toString().trim();

// Replace/Append
envContent = updateVariable(envContent, 'GIT_BUILD_BRANCH', gitBranch);
envContent = updateVariable(envContent, 'GIT_BUILD_COMMIT', gitCommitHash);

// Write data to .env file to be used in application
writeFileSync('.env', envContent.trim() + '\n');

console.log('> version saved with latest git history');
