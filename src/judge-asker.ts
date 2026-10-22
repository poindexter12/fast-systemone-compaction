import type { SystemOneAsker, SystemOneQuestions, SystemOneResponse, SystemOneState } from './types.js';

/**
 * The slice of omp's built-in judge this library needs. omp's `resolveJudge`
 * (`@oh-my-pi/pi-coding-agent/judgment`) returns one: it follows the `judge`
 * model role, native System One when that role has it and a text bridge
 * otherwise. Questions here are the same `noul` shape both speak.
 */
export interface JudgeLike {
  judge(
    request: { state: SystemOneState; questions: SystemOneQuestions },
    options?: { signal?: AbortSignal },
  ): Promise<{ answers: SystemOneResponse['answers'] }>;
}

/** Adapts omp's judge to the asker `compact` already calls. */
export function askerFromJudge(judge: JudgeLike, signal?: AbortSignal): SystemOneAsker {
  return {
    async ask(state, questions) {
      const result = await judge.judge({ state, questions }, signal ? { signal } : undefined);
      return { answers: result.answers };
    },
  };
}
