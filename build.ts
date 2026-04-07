import * as fs from 'fs/promises';
import * as path from 'path';

const SOURCE_DIR = "./lib";
const DEST_DIR = "./build";

try {
  await clearDestDir();
  await createDestDir();
  await copyResourceFiles();
  await copyHTML();
  await copyCSS();
  await bundleJS();
  console.log("Build succeeded!\n");
} catch(err) {
  console.error("Failed to build. Error: ", err);
  process.exit(1);
}

async function copyResourceFiles() {
  const resourceDir = path.join(SOURCE_DIR, "resources");
  console.log(`Copying resources from "${resourceDir}" to "${DEST_DIR}".`);

  try {
    const files = await fs.readdir(resourceDir);
    for (const file of files) {
      try {
        await fs.copyFile(path.join(resourceDir, file), path.join(DEST_DIR, file));
        console.log(`File "${file}" copied successfully!`);
      } catch(err) {
        console.error(`Failed to copy file "${file}".`);
        throw err;
      }
    }
    console.log("Resource files copied successfully!\n");
  } catch (err) {
    console.error(`Failed to read resource directory "${resourceDir}".`);
  }
}

async function copyHTML() {
  console.log("Copying and patching index.html...");
  let html = await Bun.file(path.join(SOURCE_DIR, "index.html")).text();
  html = html.replace(
    'src="./scripts/index.ts"',
    'src="./index.js"'
  );
  await Bun.write(path.join(DEST_DIR, "index.html"), html);
  console.log("index.html copied.\n");
}

async function copyCSS() {
  console.log("Copying CSS files...");

  // Copy styles directory structure
  const stylesDestDir = path.join(DEST_DIR, "styles");
  await fs.mkdir(path.join(stylesDestDir, "lib", "styles"), { recursive: true });
  await fs.mkdir(path.join(stylesDestDir, "lib", "components"), { recursive: true });

  // Main styles.css and root.css
  await fs.copyFile("lib/styles/styles.css", path.join(stylesDestDir, "styles.css"));
  await fs.copyFile("lib/styles/root.css", path.join(stylesDestDir, "lib", "styles", "root.css"));

  // Components styles
  await fs.copyFile("lib/components/styles.css", path.join(stylesDestDir, "lib", "components", "styles.css"));

  // Individual component styles
  const components = ["message", "recipient", "attachment", "embedded-msg", "error"];
  for (const comp of components) {
    const srcCSS = path.join("lib", "components", comp, "styles.css");
    try {
      await fs.access(srcCSS);
      const destDir = path.join(stylesDestDir, "lib", "components", comp);
      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(srcCSS, path.join(destDir, "styles.css"));
    } catch {
      // Component has no styles.css — skip
    }
  }

  console.log("CSS files copied.\n");
}

async function bundleJS() {
  console.log("Bundling JavaScript...");
  const result = await Bun.build({
    entrypoints: ["./lib/scripts/index.ts"],
    outdir: DEST_DIR,
    minify: true,
    target: "browser",
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error("JS bundle failed");
  }
  console.log("JavaScript bundled.\n");
}

async function clearDestDir() {
  console.log(`Clearing destination folder "${DEST_DIR}".`);
  try {
    await fs.rm(DEST_DIR, { recursive: true, force: true });
    console.log(`Destination folder "${DEST_DIR}" cleared successfully!\n`);
  } catch(err) {
    console.error(`Failed to clear destination folder "${DEST_DIR}". Error: `, err);
    throw err;
  }
}

async function createDestDir(){
  console.log(`Creating destination folder "${DEST_DIR}".`);
  try {
    await fs.mkdir(DEST_DIR, { recursive: true });
    console.log(`Successfully created destination folder "${DEST_DIR}".\n`);
  } catch(err) {
    console.error(`Failed to create destination folder "${DEST_DIR}".`);
  }
}