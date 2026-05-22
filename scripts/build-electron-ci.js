const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const spawn = util.promisify(require('child_process').spawn);

async function deleteFileIfExists(filePath) {
  const exists = await fs.pathExists(filePath);
  if (exists) {
    await fs.remove(filePath);
  }
}

async function copyFolderIfExists(srcPath, destPath) {
  const exists = await fs.pathExists(srcPath);
  if (exists) {
    await fs.copy(srcPath, destPath);
  }
}

async function removeSourceMapFiles(directory) {
  try {
    const files = await fs.readdir(directory);
    for (const file of files) {
      if (file.endsWith('.map')) {
        await fs.remove(path.join(directory, file));
      }
    }
  } catch (error) {
    console.error(`Error while deleting .map files: ${error}`);
  }
}

async function execCommandWithOutput(command) {
  return new Promise(async (resolve, reject) => {
    const childProcess = await spawn(command, {
      stdio: 'inherit',
      shell: true
    });

    childProcess.on('error', (error) => {
      reject(error);
    });

    childProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command exited with code ${code}.`));
    });
  });
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function prepareWebAssets() {
  await deleteFileIfExists('packages/bruno-electron/out');
  await deleteFileIfExists('packages/bruno-electron/web');

  await fs.ensureDir('packages/bruno-electron/web');
  await copyFolderIfExists('packages/bruno-app/dist', 'packages/bruno-electron/web');

  const webDir = 'packages/bruno-electron/web';
  const files = await fs.readdir(webDir);

  for (const file of files) {
    if (!file.endsWith('.html')) {
      continue;
    }

    const filePath = path.join(webDir, file);
    let content = await fs.readFile(filePath, 'utf8');
    content = content.replace(/\/static/g, './static');
    await fs.writeFile(filePath, content);
  }

  const cssDir = path.join(webDir, 'static/css');

  try {
    const cssFiles = await fs.readdir(cssDir);
    for (const file of cssFiles) {
      if (!file.endsWith('.css')) {
        continue;
      }

      const filePath = path.join(cssDir, file);
      let content = await fs.readFile(filePath, 'utf8');
      content = content.replace(/\/static\/font/g, '../../static/font');
      await fs.writeFile(filePath, content);
    }
  } catch (error) {
    console.error(`Error updating font paths: ${error}`);
  }

  await removeSourceMapFiles(webDir);
}

async function main() {
  try {
    const targetOs = getRequiredEnv('BUILD_TARGET_OS');
    const targetArch = getRequiredEnv('BUILD_TARGET_ARCH');

    if (!['mac', 'win', 'linux'].includes(targetOs)) {
      throw new Error(`Unsupported BUILD_TARGET_OS value: ${targetOs}`);
    }

    if (!['x64', 'arm64'].includes(targetArch)) {
      throw new Error(`Unsupported BUILD_TARGET_ARCH value: ${targetArch}`);
    }

    await prepareWebAssets();

    const configPath = 'packages/bruno-electron/electron-builder-config.ci.js';
    const buildCommand = `npx electron-builder --${targetOs} --${targetArch} --config ${configPath} --projectDir packages/bruno-electron`;

    console.log(`Building Electron for ${targetOs}/${targetArch}`);
    await execCommandWithOutput(buildCommand);
  } catch (error) {
    console.error('CI Electron build failed:', error);
    process.exitCode = 1;
  }
}

main();