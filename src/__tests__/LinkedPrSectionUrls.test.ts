import { describe, expect, it } from "vitest";

import { parsePrUrl } from "../features/integrations/utils/parsePrUrl";

// `LinkedPrSection` (TaskPreview) decides what to render with exactly
// this filter over the entity's Links list:
//
//     (links ?? []).map(l => l.url).filter(u => parsePrUrl(u) !== null)
//
// The section is shared by the task preview and the milestone preview,
// so a milestone with a PR in its Links must select the same URLs a task
// would. These pin that selection — the milestone pane previously
// rendered no PR cards at all, not because the URLs failed to parse, but
// because the section only existed in the task branch.
const selectPrUrls = (links: Array<{ url: string }> | undefined): string[] =>
    (links ?? []).map((l) => l.url).filter((u) => parsePrUrl(u) !== null);

describe("LinkedPrSection URL selection", () => {
    it("selects GitHub PR URLs", () => {
        expect(
            selectPrUrls([
                { url: "https://github.com/genos-tech/genos-api/pull/145" },
                { url: "https://github.com/genos-tech/genos-frontend/pull/237" },
            ])
        ).toHaveLength(2);
    });

    it("ignores non-PR links so a links-only entity renders nothing", () => {
        expect(
            selectPrUrls([
                { url: "https://example.com/spec" },
                { url: "https://github.com/genos-tech/genos-api" },
                { url: "https://github.com/genos-tech/genos-api/issues/12" },
            ])
        ).toEqual([]);
    });

    it("renders nothing for empty / absent links", () => {
        expect(selectPrUrls([])).toEqual([]);
        expect(selectPrUrls(undefined)).toEqual([]);
    });

    it("keeps only the PR entries from a mixed list", () => {
        expect(
            selectPrUrls([
                { url: "https://example.com/design-doc" },
                { url: "https://github.com/genos-tech/genos-api/pull/146" },
            ])
        ).toEqual(["https://github.com/genos-tech/genos-api/pull/146"]);
    });

    it("parses the owner/repo/number a milestone's card will fetch by", () => {
        // The card fetches by owner/repo/number — not by branch name —
        // which is why a PR whose branch omits the task id still works.
        expect(parsePrUrl("https://github.com/genos-tech/genos-api/pull/145")).toMatchObject({
            owner: "genos-tech",
            repo: "genos-api",
            number: 145,
        });
    });
});
