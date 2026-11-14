/**
 * The PR hover card opens with a state chip (open / draft / merged / closed) and, when
 * something ran, a CI chip (MIP-1509). The payload is the one the card already gets, so
 * no extra request is involved. A payload that names no state draws no state chip, not
 * a guessed "Closed".
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrHoverDetails } from "../features/integrations/components/PrHoverDetails";
import type { PrDetailResponse } from "../features/integrations/services/prTypes";

const payload = (
    over: Partial<PrDetailResponse["pull"]> = {},
    rest: Partial<Omit<PrDetailResponse, "pull">> = {}
): PrDetailResponse => ({
    pull: {
        title: "Fix the thing",
        number: 7,
        html_url: "https://github.com/acme/rocket/pull/7",
        state: "open",
        draft: false,
        merged: false,
        created_at: "2026-11-01T10:00:00Z",
        updated_at: "2026-11-02T10:00:00Z",
        head: { sha: "abc" },
        base: { repo: { full_name: "acme/rocket" } },
        ...over,
    },
    combined_status: null,
    check_runs: null,
    ...rest,
});

const mount = (p: PrDetailResponse, includeHeader = false) =>
    render(
        <CssVarsProvider>
            <PrHoverDetails includeHeader={includeHeader} isDark={false} payload={p} />
        </CssVarsProvider>
    );

const STATE_LABELS = ["Open", "Draft", "Merged", "Closed"];
const shown = () => STATE_LABELS.filter((l) => screen.queryByText(l) != null);

describe("PrHoverDetails: the PR state chip", () => {
    it.each([
        ["open", {}, "Open"],
        ["draft", { draft: true }, "Draft"],
        ["merged", { state: "closed", merged: true } as const, "Merged"],
        ["closed", { state: "closed" } as const, "Closed"],
    ])("a %s PR shows exactly the %s chip", (_name, over, label) => {
        mount(payload(over));

        expect(shown()).toEqual([label]);
    });

    it("a merged PR that GitHub still lists as open reads Merged, not Open", () => {
        mount(payload({ state: "open", merged: true }));

        expect(shown()).toEqual(["Merged"]);
    });

    it("shows the chip with the title header too (the table's hover)", () => {
        mount(payload({ merged: true, state: "closed" }), true);

        expect(shown()).toEqual(["Merged"]);
        expect(screen.getByText("Fix the thing")).toBeTruthy();
    });

    it("draws no state chip when the payload names no state", () => {
        mount(
            payload({
                state: undefined as unknown as "open",
                draft: undefined as unknown as boolean,
                merged: undefined as unknown as boolean,
            })
        );

        expect(shown()).toEqual([]);
        // The rest of the card is still there.
        expect(screen.getByText(/Updated/)).toBeTruthy();
    });
});

describe("PrHoverDetails: the CI chip", () => {
    it("shows CI passing when checks succeeded", () => {
        mount(
            payload(
                {},
                {
                    check_runs: {
                        total_count: 1,
                        check_runs: [{ status: "completed", conclusion: "success" }],
                    },
                }
            )
        );

        expect(screen.getByText("CI passing")).toBeTruthy();
    });

    it("shows CI failing when a check failed", () => {
        mount(
            payload(
                {},
                {
                    check_runs: {
                        total_count: 1,
                        check_runs: [{ status: "completed", conclusion: "failure" }],
                    },
                }
            )
        );

        expect(screen.getByText("CI failing")).toBeTruthy();
    });

    it("says nothing about CI when none ran", () => {
        mount(payload());

        expect(screen.queryByText(/CI/)).toBeNull();
    });
});
