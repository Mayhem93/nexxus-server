import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import * as path from 'node:path';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');
const sourceDir = path.join(projectRoot, 'src');

const packageDirs = fs.readdirSync(sourceDir, { withFileTypes: true })
  .filter(dirEnt => dirEnt.isDirectory())
  .map(dirEnt => dirEnt.name);

const buildPromises = packageDirs.map(pkgName => {
  const pkgPath = path.join(sourceDir, pkgName);
  const pkgJsonPath = path.join(pkgPath, 'package.json');

  if (!fs.existsSync(pkgJsonPath)) return Promise.resolve();

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

  if (!pkgJson.scripts?.build) {
    throw new Error(`Package ${pkgName} does not have a build script defined in its package.json`);
  }

  console.log(`Building package: ${pkgName}`);

  return new Promise((resolve, reject) => {
    exec('npm run build', { cwd: pkgPath }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Build failed for ${pkgName}:`, stderr);
        reject(error);
      } else {
        console.log(`Build output for ${pkgName}:\n${stdout}`);
        resolve();
      }
    });
  });
});

Promise.all(buildPromises)
  .then(() => console.log('All builds completed.'))
  .catch(err => {
    console.error('One or more builds failed. ' + err.message);
    process.exit(1);
  });
