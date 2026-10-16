import { describe, expect, it } from 'vitest';
import { OMP_PLUGIN_DEFAULTS, resolveOmpPluginSettings } from '../src/plugin-settings.js';

describe('omp plugin settings', () => {
  it('uses the defaults when nothing is stored', () => {
    expect(resolveOmpPluginSettings(undefined, undefined)).toEqual(OMP_PLUGIN_DEFAULTS);
  });

  it('lets a project value override the global one and ignores a value out of range', () => {
    expect(
      resolveOmpPluginSettings(
        { keepThreshold: 0.8, truncateHeadChars: 100 },
        { keepThreshold: 0.2, truncateHeadChars: -1 },
      ),
    ).toEqual({
      keepThreshold: 0.2,
      truncateHeadChars: OMP_PLUGIN_DEFAULTS.truncateHeadChars,
    });
  });
});
