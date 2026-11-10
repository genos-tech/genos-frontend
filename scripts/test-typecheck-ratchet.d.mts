// Types for scripts/test-typecheck-ratchet.mjs (plain .mjs, so its test imports it with these).
export const REPO_ROOT: string;
export const DEFAULT_BASELINE: string;
export const GLOBAL_KEY: string;
export function parseTscOutput(text: string): Map<string, number>;
export function totalOf(counts: Map<string, number>): number;
export function serializeBaseline(counts: Map<string, number>): string;
export function parseBaseline(text: string): Map<string, number>;
export function compare(
    baseline: Map<string, number>,
    current: Map<string, number>
): {
    risen: { file: string; was: number; now: number }[];
    fallen: { file: string; was: number; now: number }[];
    was: number;
    now: number;
};
export function assertTscRan(status: number | null, signal: string | null, out: string): void;
export function main(
    argv?: string[],
    options?: {
        log?: (message: string) => void;
        err?: (message: string) => void;
        baselinePath?: string;
    }
): number;
