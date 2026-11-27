/**
 * How soon an autosave that failed may go out again: at the next tick once, then waiting twice as
 * long each time, up to a minute. An outage must not put a request and an error toast on screen
 * every three seconds for as long as the preview is open (MIP-2443).
 */
export const createRetryBackoff = () => {
    let failures = 0;
    let notBefore = 0;
    return {
        ready: () => Date.now() >= notBefore,
        failed: () => {
            failures += 1;
            notBefore =
                failures > 1 ? Date.now() + Math.min(3000 * 2 ** (failures - 1), 60_000) : 0;
        },
        reset: () => {
            failures = 0;
            notBefore = 0;
        },
    };
};
