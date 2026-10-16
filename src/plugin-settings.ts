import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** `name` in `omp/package.json`. omp keys saved settings by this. */
export const OMP_PLUGIN_NAME = 'fast-systemone-compaction-omp';

/** Values used when the Plugins tab has not stored a number, or stored one out of range. */
export const OMP_PLUGIN_DEFAULTS = {
  keepThreshold: 0.5,
  truncateHeadChars: 300,
} as const;

export interface OmpPluginSettings {
  /** Minimum judge probability for a call or result to stay. 0–1. */
  keepThreshold: number;
  /** Characters kept from a tool result the judge drops. */
  truncateHeadChars: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberIn(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

/**
 * Project values override the global ones, matching omp's plugin manager.
 * A missing or out-of-range number keeps the default.
 */
export function resolveOmpPluginSettings(global: unknown, project: unknown): OmpPluginSettings {
  const merged = {
    ...(isRecord(global) ? global : {}),
    ...(isRecord(project) ? project : {}),
  };
  return {
    keepThreshold: numberIn(merged.keepThreshold, 0, 1, OMP_PLUGIN_DEFAULTS.keepThreshold),
    truncateHeadChars: numberIn(
      merged.truncateHeadChars,
      0,
      Number.POSITIVE_INFINITY,
      OMP_PLUGIN_DEFAULTS.truncateHeadChars,
    ),
  };
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Where omp stores installed-plugin settings.
 * Linux with `XDG_DATA_HOME` uses `$XDG_DATA_HOME/omp/plugins`, the same
 * data dir omp uses after `omp config migrate`. Otherwise `~/.omp/plugins`.
 */
export function ompPluginsDir(): string {
  const xdg = process.platform === 'linux' ? process.env.XDG_DATA_HOME : undefined;
  if (xdg) return path.join(xdg, 'omp', 'plugins');
  return path.join(os.homedir(), '.omp', 'plugins');
}

/**
 * Reads the numbers saved from the Plugins tab.
 * Global values live in `omp-plugins.lock.json`; a project's
 * `.omp/plugin-overrides.json` wins when both set the same key.
 */
export async function loadOmpPluginSettings(cwd: string): Promise<OmpPluginSettings> {
  const [lock, overrides] = await Promise.all([
    readJson(path.join(ompPluginsDir(), 'omp-plugins.lock.json')),
    readJson(path.join(cwd, '.omp', 'plugin-overrides.json')),
  ]);
  const globalSettings = isRecord(lock) && isRecord(lock.settings) ? lock.settings[OMP_PLUGIN_NAME] : undefined;
  const projectSettings =
    isRecord(overrides) && isRecord(overrides.settings) ? overrides.settings[OMP_PLUGIN_NAME] : undefined;
  return resolveOmpPluginSettings(globalSettings, projectSettings);
}
