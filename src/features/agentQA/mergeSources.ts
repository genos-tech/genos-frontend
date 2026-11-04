// Folding a `sources` event into the chips a turn already has.
//
// What a `sources` event is, as the server sends it: within one stream it is
// CUMULATIVE (the list so far, in arrival order; the last one before `done` is
// the same set re-ranked, plus anything the answer cited that no tool found).
// Across the legs of one turn it is not: a turn that paused on a write and was
// decided is two streams (`/ask/`, then `/decide/`), and the resumed leg starts
// its list from what the approved write created. It never repeats what the
// first leg found, nor the thread / note the ask was opened from. So an event
// can only be read as "these sources exist", never as "these are all of them":
// the chips of a turn are the union of every event it has had.
//
// The rules:
//   - A source is the one `sourceKey` names, so a chat thread shipped with and
//     without the "chat:" prefix is one chip.
//   - A source seen before keeps its place in the list. A new one goes last, in
//     the order it arrived. (The server's final re-rank of a leg is therefore
//     not applied: it only ever moved cited chips ahead of uncited ones, and the
//     chip row shows cited ones only, plus `operated` ones.)
//   - A later copy of a source updates the one held, field by field, but never
//     with less: a field the later copy leaves blank does not erase a value, and
//     `operated` never goes back to false. The server builds sources from
//     different places (a search hit carries the message it matched; the
//     citation back-fill of the final answer builds the chat source from ids
//     alone, so it does not) and itself never removes a field from a source it
//     holds (`_drive_loop` only adds `message_id`; `reconstruct_sources_for_run`
//     keeps `operated` once set).
//   - Nothing new, nothing changed: the SAME array comes back, so a caller that
//     compares by identity does no work and React renders nothing. A source that
//     did not change keeps its object, too.

import type { SpotlightResult } from "../spotlight/types";
import { sourceKey } from "./citationUtils";

// No information: a later copy carrying one of these for a field says nothing
// about it.
const isBlank = (v: unknown): boolean =>
    v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

const sameValue = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
    }
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
        const ka = Object.keys(a);
        return (
            ka.length === Object.keys(b).length &&
            ka.every((k) =>
                sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
            )
        );
    }
    return false;
};

// `later` laid over `have`; `have` itself when it changes nothing.
const overlay = (have: SpotlightResult, later: SpotlightResult): SpotlightResult => {
    let out = have;
    for (const key of Object.keys(later) as (keyof SpotlightResult)[]) {
        const value = later[key];
        if (isBlank(value)) continue;
        if (key === "operated" && have.operated === true) continue;
        if (sameValue(have[key], value)) continue;
        if (out === have) out = { ...have };
        (out as unknown as Record<string, unknown>)[key] = value;
    }
    return out;
};

export const mergeSources = (
    held: SpotlightResult[],
    incoming: readonly SpotlightResult[]
): SpotlightResult[] => {
    let next: SpotlightResult[] | null = null;
    const at = new Map<string, number>();
    held.forEach((s, i) => at.set(sourceKey(s), i));
    for (const src of incoming) {
        const key = sourceKey(src);
        const i = at.get(key);
        if (i === undefined) {
            next ??= held.slice();
            at.set(key, next.push(src) - 1);
            continue;
        }
        const have = (next ?? held)[i];
        const merged = overlay(have, src);
        if (merged === have) continue;
        next ??= held.slice();
        next[i] = merged;
    }
    return next ?? held;
};
