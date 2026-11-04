/**
 * PR links in messages and task comments are one-line chips that send nothing
 * until they are hovered (MIP-1000).
 *
 * They used to be a full `LinkedPrCard` each, and every card fetched the PR
 * detail (three GitHub calls on the server) as it mounted: opening a task whose
 * comments list a dozen PRs sent a dozen requests at once.
 */

import type { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MessagePrUnfurls } from "../features/integrations/components/MessagePrUnfurls";
import { getCachedOrFetchPrStatus } from "../features/integrations/services/prStatusCache";

vi.mock("../features/integrations/services/prStatusCache", () => ({
    getCachedOrFetchPrStatus: vi.fn(),
}));
vi.mock("../features/integrations/components/PrHoverDetails", () => ({
    PrHoverDetails: () => <div data-testid="hover-card" />,
}));
// Render the tooltip body inline, so its text can be read without hover delays.
vi.mock("../components/ui/AppTooltip", () => ({
    AppTooltip: ({ title, children }: { title: ReactNode; children: ReactNode }) => (
        <div>
            {children}
            <div data-testid="tooltip">{title}</div>
        </div>
    ),
}));

const mockStatus = vi.mocked(getCachedOrFetchPrStatus);

const prUrl = (n: number) => `https://github.com/acme/rocket/pull/${n}`;

const detailFor = (n: number, pull: Record<string, unknown>) =>
    ({
        kind: "ok",
        payload: {
            pull: {
                number: n,
                title: `Live title ${n}`,
                base: { repo: { full_name: "acme/rocket" } },
                ...pull,
            },
            combined_status: null,
            check_runs: null,
        },
    }) as never;

const mount = async (urls: string[], token = "tok") => {
    render(
        <CssVarsProvider>
            <MessagePrUnfurls accessToken={token} urls={urls} />
        </CssVarsProvider>
    );
    await act(async () => {});
};

const chips = () => screen.getAllByRole("link");

beforeEach(() => {
    mockStatus.mockReset();
});

describe("MessagePrUnfurls: nothing is sent until a chip is hovered", () => {
    it("a message listing several PRs sends no request at mount", async () => {
        await mount([prUrl(1), prUrl(2), prUrl(3), prUrl(4)]);

        expect(chips()).toHaveLength(4);
        expect(mockStatus).not.toHaveBeenCalled();
    });

    it("a chip names the PR and links to GitHub, in the order of the links", async () => {
        await mount([prUrl(7), prUrl(2)]);

        expect(chips().map((c) => c.getAttribute("href"))).toEqual([prUrl(7), prUrl(2)]);
        expect(chips()[0].textContent).toContain("acme/rocket #7");
    });

    it("shows no state, title or CI before anyone has looked: nothing is known about the PR", async () => {
        await mount([prUrl(7)]);

        const chip = chips()[0].textContent ?? "";
        expect(chip).not.toMatch(/Merged|Closed|Open|Draft/);
        const tip = screen.getByTestId("tooltip").textContent ?? "";
        expect(tip).toContain("acme/rocket #7");
        expect(tip).not.toMatch(/Merged|Closed|Open|Draft|CI|checks/i);
    });

    it("hover asks once, then the chip shows the live state and title and the rich card appears", async () => {
        mockStatus.mockResolvedValue(detailFor(7, { state: "closed", merged: true }));
        await mount([prUrl(7)]);

        await act(async () => {
            fireEvent.mouseEnter(chips()[0]);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(mockStatus).toHaveBeenCalledWith("tok", prUrl(7));
        expect(chips()[0].textContent).toContain("Merged");
        expect(chips()[0].textContent).toContain("Live title 7");
        expect(screen.getByTestId("hover-card")).toBeTruthy();
    });

    it("an open PR reads Open, a draft reads Draft", async () => {
        mockStatus.mockImplementation(async (_t, url) =>
            url === prUrl(1)
                ? detailFor(1, { state: "open", merged: false, draft: false })
                : detailFor(2, { state: "open", merged: false, draft: true })
        );
        await mount([prUrl(1), prUrl(2)]);

        await act(async () => {
            fireEvent.mouseEnter(chips()[0]);
            fireEvent.mouseEnter(chips()[1]);
        });

        expect(chips()[0].textContent).toContain("Open");
        expect(chips()[1].textContent).toContain("Draft");
    });

    it("hovering one chip asks for that PR only", async () => {
        mockStatus.mockResolvedValue(detailFor(2, { state: "closed", merged: true }));
        await mount([prUrl(1), prUrl(2), prUrl(3)]);

        await act(async () => {
            fireEvent.mouseEnter(chips()[1]);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(mockStatus).toHaveBeenCalledWith("tok", prUrl(2));
    });

    it("focus alone asks (keyboard users)", async () => {
        mockStatus.mockResolvedValue(detailFor(7, { state: "closed", merged: true }));
        await mount([prUrl(7)]);

        await act(async () => {
            fireEvent.focus(chips()[0]);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it("further hovers and focuses do not ask again", async () => {
        mockStatus.mockResolvedValue(detailFor(7, { state: "closed", merged: true }));
        await mount([prUrl(7)]);

        for (const fire of [fireEvent.mouseEnter, fireEvent.focus, fireEvent.mouseEnter]) {
            await act(async () => {
                fire(chips()[0]);
            });
        }

        expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it("a failed lookup keeps the chip as it was, shows no card, and is not retried", async () => {
        mockStatus.mockResolvedValue({ kind: "error" });
        await mount([prUrl(7)]);

        await act(async () => {
            fireEvent.mouseEnter(chips()[0]);
        });
        await act(async () => {
            fireEvent.mouseEnter(chips()[0]);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("hover-card")).toBeNull();
        expect(chips()[0].textContent).not.toMatch(/Merged|Closed|Open|Draft/);
    });

    it("a user without GitHub connected still gets the chip (a plain link), and no retries", async () => {
        mockStatus.mockResolvedValue({ kind: "github_not_connected" });
        await mount([prUrl(7)]);

        await act(async () => {
            fireEvent.mouseEnter(chips()[0]);
        });
        await act(async () => {
            fireEvent.mouseEnter(chips()[0]);
        });

        expect(chips()).toHaveLength(1);
        expect(chips()[0].getAttribute("href")).toBe(prUrl(7));
        expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it("with no session, hovering sends nothing", async () => {
        await mount([prUrl(7)], "");

        await act(async () => {
            fireEvent.mouseEnter(chips()[0]);
        });

        expect(mockStatus).not.toHaveBeenCalled();
    });
});
