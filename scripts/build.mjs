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
 * Prerelease-aware publishing
 * --------------------------
 * Where a build is published depends on whether the version is a semver prerelease
 * (anything with a `-`, e.g. `1.3.3-alpha.0`):
 *
 *   prerelease -> Snap Store `edge`  + GitHub "pre-release"
 *   release    -> Snap Store `stable` + GitHub full release
 *
 * `snapcraft.publish` stays declarative in electron-builder.json5 (baseline: `stable`).
 * Its channel cannot be overridden through the programmatic `config`: electron-builder
 * deep-merges configs, arrays are *concatenated* rather than replaced, and
 * `SnapTarget#findSnapPublishConfig` returns the first `snapStore` entry — so the on-disk
 * value would always win. We therefore wrap that method and rewrite the returned config's
 * `channels`. The GitHub release type is a plain scalar, so it is overridden through the
 * public `config.publish` option instead.
 *
 * Set `SNAP_CHANNEL=<channel>` to force a channel regardless of the version (handy for a
 * one-off manual release).
 *
 * Removal
 * -------
 * The `SnapCore24#createDescriptor` wrapper is an inert no-op on electron-builder >= 27 (the
 * offending key no longer exists there). The publishing policy below is project policy, not
 * a workaround and should be kept.
 *
 * To remove this file entirely, also restore the `build` script to
 * `tsc && vite build && electron-builder --linux`.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)

// --- Publishing policy (see header) ---------------------------------------
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const isPrerelease = /^\d+\.\d+\.\d+-/.test(version)
const snapChannel = process.env.SNAP_CHANNEL ?? (isPrerelease ? 'edge' : 'stable')
const githubReleaseType = isPrerelease ? 'prerelease' : 'release'

// Surfaced in the build log so a CI run shows exactly where it will publish.
console.log(
  `[build] version ${version} (prerelease=${isPrerelease}) -> Snap Store channel '${snapChannel}', GitHub releaseType '${githubReleaseType}'`,
)

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

// Prereleases go to the Snap Store `edge` channel; real releases stay on `stable`.
// Runs before electron-builder is loaded, on the shared module instance it will use.
try {
  const SnapTarget = require('app-builder-lib/out/targets/snap/SnapTarget').default
  const original = SnapTarget != null ? SnapTarget.prototype.findSnapPublishConfig : undefined
  if (typeof original === 'function') {
    SnapTarget.prototype.findSnapPublishConfig = function findSnapPublishConfig(config) {
      const result = original.call(this, config)
      if (result != null) {
        // Applied to the single config electron-builder hands to the Snap Store publisher.
        console.log(`[build] Snap Store publish channel -> ${snapChannel}`)
        result.channels = snapChannel
      }
      return result
    }
  }
}
catch (error) {
  // If electron-builder's internals change, fall back to the `channels` value declared in
  // electron-builder.json5 (currently `stable`).
  console.warn(
    `[build] snap channel override (${snapChannel}) not installed: ${error.message}`,
  )
}

const { build, Platform } = require('electron-builder')

const publishIndex = process.argv.indexOf('--publish')

/** @type {Record<string, unknown>} */
const options = {
  // `createTarget()` with no arguments mirrors the CLI's `--linux`: the concrete targets
  // are read from `linux.target` in electron-builder.json5.
  targets: Platform.LINUX.createTarget(),
  config: {
    // GitHub release type. `releaseType` defaults to `draft`, so it is always supplied
    // explicitly. Merges into the on-disk `publish` object (scalars are replaced).
    publish: { releaseType: githubReleaseType },
  },
}

if (publishIndex !== -1) {
  options.publish = process.argv[publishIndex + 1]
}

await build(options)
