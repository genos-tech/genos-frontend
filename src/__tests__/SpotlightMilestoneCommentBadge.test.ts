/**
 * A comment on a milestone gets the same "comment" badge and chip as a
 * comment on a task.
 *
 * A milestone's comments hang off its backing task, so the backend indexes
 * them as `task_comment` chunks and, when that is the only representation
 * of the hit, relabels the row to `entity_type: "milestone"` keeping
 * `matched_chunk_types` (genos-api `milestone_mirrors.py`). The badge
 * used to check `entity_type === "task"` only, so the relabeled row lost it.
 */

import { describe, expect, it } from "vitest";

import { sourceChipLabel } from "../features/spotlight/SpotlightContent";
import { badgeFor } from "../features/spotlight/SpotlightResultItem";
import type { SpotlightResult } from "../features/spotlight/types";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const row = (over: Partial<SpotlightResult>): SpotlightResult =>
    ({
        entity_type: "task",
        entity_id: "task:1",
        title: "Beta launch",
        snippet: null,
        score: 1,
        keyword_rank: 1,
        vector_rank: null,
        matched_chunk_types: ["task_title_content"],
        matched_terms: [],
        updated_at: null,
        chat_type: null,
        chat_id: null,
        thread_id: null,
        message_id: null,
        task_id: "1",
        task_display_id: "MIP-1",
        ...over,
    }) as SpotlightResult;

const milestone = (chunkTypes: string[]) =>
    row({ entity_type: "milestone", entity_id: "milestone:9", matched_chunk_types: chunkTypes });

describe("badgeFor", () => {
    it("marks a milestone row whose best chunk is a comment", () => {
        expect(badgeFor(milestone(["task_comment", "task_title_content"]))).toBe("comment");
    });

    it("leaves a milestone matched on its title or goal unbadged", () => {
        expect(badgeFor(milestone(["milestone_title_content"]))).toBeNull();
        expect(badgeFor(milestone(["task_title_content", "task_comment"]))).toBeNull();
    });

    it("still marks a task comment and leaves a task title unbadged", () => {
        expect(badgeFor(row({ matched_chunk_types: ["task_comment"] }))).toBe("comment");
        expect(badgeFor(row({}))).toBeNull();
    });
});

describe("source chip label", () => {
    const ts = en.spotlight;

    it("says a milestone hit came from a comment", () => {
        expect(sourceChipLabel(milestone(["task_comment"]), ts)).toBe(
            "Milestone comment: Beta launch"
        );
    });

    it("keeps the plain milestone label otherwise", () => {
        expect(sourceChipLabel(milestone(["milestone_title_content"]), ts)).toBe(
            "Milestone: Beta launch"
        );
    });

    it("is translated in every locale", () => {
        for (const [name, loc] of Object.entries({ ar, es, fr, hi, ja, zh })) {
            const tpl = loc.spotlight?.chip?.milestoneComment;
            expect(tpl, name).toBeTruthy();
            expect(tpl, name).not.toBe(en.spotlight.chip.milestoneComment);
            expect(tpl, name).toContain("{subtitle}");
            expect(tpl, name).toContain("{sep}");
        }
    });
});
