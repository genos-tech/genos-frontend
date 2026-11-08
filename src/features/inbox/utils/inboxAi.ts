/**
 * What an AI-made Inbox item cost, and the source it can be switched off at (MIP-1227, the card
 * half of genos-api MIP-1209).
 *
 * The server stores the cost in `itemOptionals.ai` and gives the item an `aiSource`. Both are
 * read here as UNTRUSTED, in one place, because `itemOptionals` is a free-form blob a teammate
 * can write on an ordinary item filed to the member (an activity notice, type 0): without a gate
 * the card would draw whatever such a sender put there, and offer a switch that is not theirs to
 * offer. So nothing is drawn unless ALL of these hold:
 *
 *   - the item is a digest (6) and `ai.producer` and `aiSource.kind` both say `digest`, or
 *   - the item is a report (10) and both say `schedule`;
 *   - every number is a plain integer in range and every flag a real boolean.
 *
 * No string out of `ai` is ever shown. The only text that survives is the schedule's name
 * (`aiSource.label`), drawn as plain text, and only for a report.
 */
import type { InboxAiSource, InboxItemProps } from "../../../types/common";
import { GENOS_REPORT_ITEM_TYPE } from "./genosReport";

export const DIGEST_ITEM_TYPE = 6;

/** More than any real request could cost (a million credits): a bigger number is a forged one. */
const MAX_CREDITS_MILLI = 1_000_000_000;
const MAX_NAME = 100;
const MAX_ID = 64;

export type AiCost =
    /** The cost meter was off: the item used AI and nothing more is known. */
    | { metered: false }
    | {
          metered: true;
          /** Milli-credits: 1830 is 1.83 credits, the unit on Plan & usage. */
          creditsMilli: number;
          /** Some calls were unpriced, so the cost is at least this. */
          lowerBound: boolean;
          /** What was actually taken from the balance (0 for the digest, which is not billed). */
          deductedMilli: number;
      };

export type AiSourceView = {
    kind: "digest" | "schedule";
    /** Switch state and the source's identity: the key the shared store is keyed by. */
    key: string;
    enabled: boolean;
    /** A schedule's own name, or "" (the digest is named by the app, in the member's language). */
    name: string;
    /** The schedule was deleted: the cost is still shown, there is nothing to switch. */
    gone: boolean;
};

export type AiUsage = {
    cost: AiCost;
    /** Null when the item carries no usable `aiSource`: the cost shows, there is no switch. */
    source: AiSourceView | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;

const milli = (value: unknown): number | null =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_CREDITS_MILLI
        ? value
        : null;

const text = (value: unknown, limit: number): string =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";

const parseSource = (raw: unknown, kind: "digest" | "schedule"): AiSourceView | null => {
    const source = asRecord(raw);
    if (!source || source.kind !== kind || typeof source.enabled !== "boolean") return null;
    if (kind === "digest") {
        return { kind, key: "digest", enabled: source.enabled, name: "", gone: false };
    }
    const id = text(source.schedule_id, MAX_ID);
    if (id === "") return null;
    return {
        kind,
        key: `schedule:${id}`,
        enabled: source.enabled,
        name: text(source.label, MAX_NAME),
        gone: source.gone === true,
    };
};

/** The AI usage line and switch an item may draw, or null: nothing at all. */
export const readAiUsage = (
    item: Pick<InboxItemProps, "itemType" | "itemOptionals" | "aiSource">
): AiUsage | null => {
    const producer =
        item.itemType === DIGEST_ITEM_TYPE
            ? "digest"
            : item.itemType === GENOS_REPORT_ITEM_TYPE
              ? "schedule"
              : null;
    if (producer === null) return null;
    const ai = asRecord(asRecord(item.itemOptionals)?.ai);
    if (!ai || ai.producer !== producer) return null;

    let cost: AiCost;
    if (ai.metered === true) {
        const creditsMilli = milli(ai.credits_milli);
        const deductedMilli = milli(ai.deducted_credits_milli);
        if (creditsMilli === null || deductedMilli === null) return null;
        cost = { metered: true, creditsMilli, lowerBound: ai.lower_bound === true, deductedMilli };
    } else if (ai.metered === false) {
        cost = { metered: false };
    } else {
        return null;
    }
    return {
        cost,
        source: parseSource(item.aiSource as InboxAiSource | null | undefined, producer),
    };
};
