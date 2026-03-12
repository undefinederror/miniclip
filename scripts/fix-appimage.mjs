import fs from 'fs/promises';
import path from 'path';

export default async function (context) {
  const version = process.env.npm_package_version;
  const desktopPath = path.join(process.cwd(), 'build/applications/com.miniclip.app.desktop');
  let content = await fs.readFile(desktopPath, 'utf8');
  content = content.replace(/(X-AppImage-Version=).*$/m, `$1${version}`);
  await fs.writeFile(desktopPath, content);
};
