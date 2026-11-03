/**
 * Returns `prev` when `next` is structurally equal to it, otherwise `next`.
 *
 * Built for the background refreshes that re-fetch a list on a timer and
 * write the answer straight into React state. Every fetch hands back a
 * brand-new array even when the server said nothing changed, and a new
 * identity invalidates every `useMemo`, `memo` comparator and effect
 * dependency downstream of it. Used as the functional-updater body
 * (`setState((prev) => keepIfEqual(prev, next))`), React bails out of the
 * write when the same reference comes back, so an unchanged refresh costs
 * no re-render at all while a real change still lands as a new reference.
 *
 * Equality is JSON equality, which is exactly right for the payloads this
 * is used on (plain objects, arrays, strings, numbers, booleans, null as
 * they come off the wire or out of IndexedDB) and cheap enough for a few
 * hundred rows. It is NOT safe for values JSON flattens: `Map`, `Set`,
 * `Date`, functions, `undefined`-valued keys and `NaN` serialize lossily,
 * so two different values could compare equal and the state would go
 * stale. Don't use it for those.
 *
 * It errs only toward "not equal": a differing key order, or anything
 * `JSON.stringify` refuses (a cycle, a `BigInt`), returns `next` — one
 * extra render, never stale data.
 *
 * `ignoreKeys` names fields that may differ without counting as a change, at
 * any depth. Use it ONLY for bookkeeping that nothing renders: when `next`
 * is judged equal the caller keeps `prev`, so an ignored field in the kept
 * value is the old one. (The team roster ignores `tsLastSeen`: every online
 * member's heartbeat rewrites it once a minute and the UI reads presence
 * from the `isOnline` flag derived from it, never from the timestamp.)
 */
export function keepIfEqual<T>(prev: T, next: T, ignoreKeys?: readonly string[]): T {
    if (Object.is(prev, next)) return prev;
    // Different lengths can't be equal; skip serializing two large payloads.
    if (Array.isArray(prev) && Array.isArray(next) && prev.length !== next.length) {
        return next;
    }
    try {
        const replacer =
            ignoreKeys && ignoreKeys.length > 0
                ? (key: string, value: unknown) => (ignoreKeys.includes(key) ? undefined : value)
                : undefined;
        return JSON.stringify(prev, replacer) === JSON.stringify(next, replacer) ? prev : next;
    } catch {
        return next;
    }
}
