#!/usr/bin/env node
/**
 * Applies patches from the patches/ directory to node_modules.
 *
 * This is a minimal replacement for `patch-package` that avoids adding
 * a runtime dependency. Each .patch file in patches/ is applied with
 * `patch --forward --strip=1` against node_modules.
 *
 * The patch for app-builder-lib removes the `desktop: meta/gui/...` field
 * from the generated core24 snapcraft.yaml apps section. Without this field,
 * snapcraft auto-detects the desktop file from snap/gui/ correctly.
 *
 * See: https://github.com/electron-userland/electron-builder/pull/10176
 */
import { readdirSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const patchesDir = join(root, "patches");

if (!existsSync(patchesDir)) {
  process.exit(0);
}

const patches = readdirSync(patchesDir).filter((f) => f.endsWith(".patch"));
let failed = false;

for (const patch of patches) {
  const patchPath = join(patchesDir, patch);
  // --forward: treat already-applied patches as success (idempotent)
  // --strip=1: strip the leading a/ or b/ from paths
  const result = spawnSync(
    "patch",
    ["--forward", "--strip=1", "--input", patchPath],
    { cwd: root, encoding: "utf8", stdio: "inherit" }
  );
  if (result.status !== 0 && result.status !== 1) {
    // patch exits 1 when already applied (--forward), anything else is an error
    console.error(`Failed to apply patch: ${patch}`);
    failed = true;
  }
}

if (failed) process.exit(1);
