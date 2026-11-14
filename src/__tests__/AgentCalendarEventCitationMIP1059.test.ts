/**
 * A calendar event as a citable source (MIP-1059, genos-api AGENT_PARITY_TOOLS).
 *
 * The model writes `[prose](calendar_event:<account_id>:<event_id>)` (or the bare, group and raw
 * spellings every type has). Unlike the other types the grammar REQUIRES the account's UUID in the
 * tail, so "[calendar_event: standup]" in prose is not eaten. The event id may carry `_` and, for a
 * recurring instance, an upper-case `T` and `Z`.
 */

import { describe, expect, it } from "vitest";

import { markdownToBlocks } from "../features/agentQA";
import {
    buildSourcesById,
    CITATION_HREF_PREFIX,
    citedChipSources,
    extractBareCitedIds,
    extractInlineCitedIds,
    resolveCitationToken,
    rewriteCitations,
} from "../features/agentQA/citationUtils";
import { mergeSources } from "../features/agentQA/mergeSources";
import type { SpotlightResult } from "../features/spotlight/types";

const ACCOUNT = "8f5e4733-1a2b-4c3d-8e9f-0123456789ab";
const OTHER_ACCOUNT = "11111111-2222-3333-4444-555555555555";
const TOKEN = `calendar_event:${ACCOUNT}:abc123def`;
const RECURRING = `calendar_event:${ACCOUNT}:abc123def_20261201T010000Z`;

const event = (entity_id: string, over: Partial<SpotlightResult> = {}): SpotlightResult =>
    ({
        entity_type: "calendar_event",
        entity_id,
        title: "Standup",
        account_id: ACCOUNT,
        calendar_id: "primary",
        event_id: entity_id.split(":")[2],
        ...over,
    }) as unknown as SpotlightResult;

const noSources = new Map<string, SpotlightResult>();

describe("the calendar_event token", () => {
    it("rewrites a resolved prose link to the citation sentinel", () => {
        const sources = buildSourcesById([event(TOKEN)]);
        expect(rewriteCitations(`Your [standup](${TOKEN}) moved.`, sources)).toBe(
            `Your [standup](${CITATION_HREF_PREFIX}${TOKEN}) moved.`
        );
    });

    it("drops an unresolved link to its prose (no dead link, no raw id)", () => {
        const sources = buildSourcesById([event(TOKEN)]);
        const other = `calendar_event:${OTHER_ACCOUNT}:zzz`;
        expect(rewriteCitations(`See [the call](${other}) now.`, sources)).toBe(
            "See the call now."
        );
    });

    it("strips the bare spelling, alone and in a group, and the raw leak", () => {
        expect(rewriteCitations(`Moved [${TOKEN}].`, noSources)).toBe("Moved.");
        expect(rewriteCitations(`Moved [${TOKEN}, task:42].`, noSources)).toBe("Moved.");
        expect(rewriteCitations(`Moved (${TOKEN}) today.`, noSources)).toBe("Moved today.");
    });

    it("does not eat prose that only looks like it", () => {
        for (const prose of [
            "A note [calendar_event: standup] to self.",
            "Use [calendar_event:abc] in the text.",
            "The tag calendar_event: is a type name.",
            `A malformed [calendar_event:not-a-uuid:abc123] token.`,
        ]) {
            expect(rewriteCitations(prose, noSources)).toBe(prose);
        }
    });

    it("matches a recurring instance's upper-case T and Z", () => {
        const sources = buildSourcesById([event(RECURRING)]);
        expect(rewriteCitations(`The [weekly](${RECURRING}) call.`, sources)).toBe(
            `The [weekly](${CITATION_HREF_PREFIX}${RECURRING}) call.`
        );
        expect([...extractBareCitedIds(`Cited [${RECURRING}].`)]).toEqual([RECURRING]);
    });

    it("reads the inline and the bare citation as the cited ids", () => {
        const sources = buildSourcesById([event(TOKEN)]);
        expect([...extractInlineCitedIds(`The [call](${TOKEN}).`, sources)]).toEqual([TOKEN]);
        expect([...extractBareCitedIds(`The call [${TOKEN}].`)]).toEqual([TOKEN]);
    });

    it("resolves a token whose case the server changed, but never a different id", () => {
        const sources = buildSourcesById([event(RECURRING)]);
        const lower = RECURRING.toLowerCase();
        expect(resolveCitationToken(lower, sources)?.key).toBe(RECURRING);
        expect(resolveCitationToken(`${RECURRING}9`, sources)).toBeNull();
    });
});

describe("the chips of a turn", () => {
    it("keeps an operated event chip the prose never cited", () => {
        const operated = event(TOKEN, { operated: true });
        expect(citedChipSources("All done.", [operated])).toEqual([operated]);
    });

    it("shows a read event only when it is cited", () => {
        const read = event(TOKEN);
        expect(citedChipSources("All done.", [read])).toEqual([]);
        expect(citedChipSources(`Your [standup](${TOKEN}).`, [read])).toEqual([read]);
    });

    it("keeps the title and times an earlier read set when a delete chip arrives blank", () => {
        const read = event(TOKEN, {
            event_start: "2026-12-01T10:00:00+09:00",
            event_end: "2026-12-01T10:30:00+09:00",
            event_all_day: false,
        });
        const deleted = event(TOKEN, {
            title: "",
            event_start: null,
            event_end: null,
            event_all_day: null,
            operated: true,
        });
        const [merged] = mergeSources([read], [deleted]);
        expect(merged.title).toBe("Standup");
        expect(merged.event_start).toBe("2026-12-01T10:00:00+09:00");
        expect(merged.event_all_day).toBe(false);
        expect(merged.operated).toBe(true);
    });

    it("keeps two accounts' events with the same id as two chips", () => {
        const a = event(TOKEN);
        const b = event(`calendar_event:${OTHER_ACCOUNT}:abc123def`, {
            account_id: OTHER_ACCOUNT,
        });
        expect(mergeSources([a], [b])).toHaveLength(2);
    });
});

describe("saving an answer as a note", () => {
    it("keeps a cited event as text: a note has no URL to open it with, so no dead link", () => {
        const sources = buildSourcesById([event(TOKEN)]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content = (
            markdownToBlocks(`Your [standup](${TOKEN}) and ${`[${TOKEN}]`}.`, sources)[0] as any
        ).content as Array<{ type: string; text?: string }>;
        expect(content.some((n) => n.type === "link")).toBe(false);
        const text = content.map((n) => n.text ?? "").join("");
        expect(text).toContain("standup");
        expect(text).toContain("Standup");
        expect(text).not.toContain("calendar_event:");
    });
});
