import { describe, expect, it } from "vitest";

import { entityRefToHref } from "../utils/entityHref";
import { parseInternalUrl } from "../utils/parseInternalUrl";

// A `#`-mentioned note has to survive a full round trip: menu -> chip
// props -> href -> parsed target -> modal. Team Notes were missing from
// the last three links in that chain, so a team note mentioned fine but
// resolved as a My Note.
describe("team note deep links", () => {
    it("builds a /team/ href", () => {
        expect(entityRefToHref({ entityType: "note", noteKind: "team", noteId: "42" })).toBe(
            "/workspace/notes/team/42"
        );
    });

    it("parses that href back to a teamNote target", () => {
        const parsed = parseInternalUrl(`${window.location.origin}/workspace/notes/team/42`);
        expect(parsed).toEqual({ kind: "teamNote", noteId: 42 });
    });

    it("keeps my / shared / team as DISTINCT targets", () => {
        // The regression that motivated this: `team` fell through to the
        // `my` branch, so a team note opened in the wrong section.
        const kinds = (["my", "shared", "team"] as const).map((noteKind) => {
            const href = entityRefToHref({ entityType: "note", noteKind, noteId: "7" });
            return (parseInternalUrl(`${window.location.origin}${href}`) as { kind: string }).kind;
        });
        expect(kinds).toEqual(["myNote", "sharedNote", "teamNote"]);
        expect(new Set(kinds).size).toBe(3);
    });
});
