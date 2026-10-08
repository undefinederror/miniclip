import fs from 'fs/promises';
import path from 'path';

export default async function (context) {
  // `npm_package_version` is only set when the build is invoked through npm; fall back to
  // package.json so the value stays correct when scripts/build.mjs is run directly.
  const version =
    process.env.npm_package_version ??
    JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
  const desktopPath = path.join(process.cwd(), 'build/applications/com.miniclip.app.desktop');
  let content = await fs.readFile(desktopPath, 'utf8');
  content = content.replace(/(X-AppImage-Version=).*$/m, `$1${version}`);
  await fs.writeFile(desktopPath, content);
};
