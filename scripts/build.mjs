#!/usr/bin/env node
/**
 * Programmatic electron-builder entry point.
 *
 * Why this exists
 * ---------------
 * electron-builder 26.x's core24 snap target emits an `apps.<app>.desktop` mapping
 * (e.g. `desktop: meta/gui/miniclip.desktop`) into the generated snapcraft.yaml.
 * snapcraft (9.x) resolves that value against the prime/anchor directory, cannot find
 * the file, and aborts the build with:
 *
 *   Failed to generate desktop file '.../snap/meta/gui/miniclip.desktop':
 *     file does not exist (defined in app 'miniclip')
 *
 * snapcraft already copies the project's `snap/gui/` directory into `meta/gui/`, so the
 * mapping is redundant. Upstream fixed this in electron-builder PR #10176 (issue #10077),
 * first shipped in electron-builder 27.0.0-alpha.9.
 *
 * Why a programmatic build (and not `effectiveOptionComputed`)
 * -----------------------------------------------------------
 * electron-builder writes the snapcraft.yaml to disk *before* it calls the
 * `effectiveOptionComputed` hook, so mutating the in-memory descriptor there has no effect
 * on the file snapcraft actually reads. Instead we wrap `SnapCore24#createDescriptor`,
 * which runs *before* the yaml is written, and drop the key from the descriptor it returns.
 *
 * This does not modify any file on disk (no node_modules patching).
 *
 * Removal once electron-builder >= 27 is adopted
 * ----------------------------------------------
 * With >= 27 the key no longer exists, so the wrapper is an inert no-op and may simply be
 * left in place. To remove it, delete this file and restore the `build` script to
 * `tsc && vite build && electron-builder --linux`.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
/**
 * Removes the redundant `apps.<app>.desktop` key from a snapcraft descriptor, if present.
 *
 * @param {unknown} descriptor
 */
function stripRedundantSnapDesktopMapping(descriptor) {
  const apps = descriptor != null ? descriptor.apps : undefined
  if (apps == null || typeof apps !== 'object') {
    return
  }
  for (const app of Object.values(apps)) {
    if (app != null && typeof app === 'object' && 'desktop' in app) {
      delete app.desktop
    }
  }
}

// Install the workaround before electron-builder is loaded so the prototype is patched on
// the shared `app-builder-lib` module instance electron-builder will use.
try {
  const { SnapCore24 } = require('app-builder-lib/out/targets/snap/core24')
  const original = SnapCore24 != null ? SnapCore24.prototype.createDescriptor : undefined
  if (typeof original === 'function') {
    SnapCore24.prototype.createDescriptor = async function createDescriptor(arch) {
      const descriptor = await original.call(this, arch)
      stripRedundantSnapDesktopMapping(descriptor)
      return descriptor
    }
  }
}
catch (error) {
  // If electron-builder's internals change, fall back to the unmodified behaviour — which
  // is already correct on electron-builder >= 27.
  console.warn(
    `[build] core24 snap desktop-mapping workaround not installed: ${error.message}`,
  )
}

const { build, Platform } = require('electron-builder')

const publishIndex = process.argv.indexOf('--publish')

/** @type {Record<string, unknown>} */
const options = {
  // `createTarget()` with no arguments mirrors the CLI's `--linux`: the concrete targets
  // are read from `linux.target` in electron-builder.json5.
  targets: Platform.LINUX.createTarget(),
}

if (publishIndex !== -1) {
  options.publish = process.argv[publishIndex + 1]
}

await build(options)
