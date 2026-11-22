// "230ms" below a second, "1.8s" above — SI notation, deliberately not
// localized (matches how every locale reads durations in tech UIs, so
// the strip and the per-turn total can share it without label props).
export const formatDurationMs = (ms: number): string =>
    ms < 1000 ? `${Math.max(ms, 0)}ms` : `${(ms / 1000).toFixed(1)}s`;
