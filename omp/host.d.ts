/** Ambient types so this plugin typechecks without installing omp. */
declare module '@oh-my-pi/pi-coding-agent/judgment' {
  export interface JudgeLike {
    judge(
      request: { state: unknown; questions: Record<string, unknown> },
      options?: { signal?: AbortSignal },
    ): Promise<{ answers: Record<string, { type?: 'noul'; noul: number }> }>;
  }
  export function resolveJudge(deps: {
    settings: unknown;
    registry: unknown;
    sessionModel?: unknown;
    purpose: string;
    onUsage?: unknown;
  }): JudgeLike;
  export function journalJudgmentUsage(manager: unknown): unknown;
}

declare module '@oh-my-pi/pi-coding-agent/config/settings' {
  export const settings: unknown;
}
