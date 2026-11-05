/**
 * A PR link in a task comment or a chat message is a card-shaped placeholder
 * that sends nothing; hovering, focusing or clicking it loads the real card in
 * the same slot (MIP-1003).
 *
 * The real `LinkedPrCard` is used (only the request is mocked): a stub could
 * not show that the request starts at the reveal and not before.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LazyPrCard } from "../features/integrations/components/LazyPrCard";
import { getCachedOrFetchPrStatus } from "../features/integrations/services/prStatusCache";

vi.mock("../features/integrations/services/prStatusCache", () => ({
    getCachedOrFetchPrStatus: vi.fn(),
}));

const mockStatus = vi.mocked(getCachedOrFetchPrStatus);
const prUrl = (n: number) => `https://github.com/acme/rocket/pull/${n}`;

const mount = async (urls: string[], hideOnNotConnected = true) => {
    const view = render(
        <CssVarsProvider>
            {urls.map((u) => (
                <LazyPrCard
                    key={u}
                    accessToken="tok"
                    hideOnNotConnected={hideOnNotConnected}
                    url={u}
                />
            ))}
        </CssVarsProvider>
    );
    await act(async () => {});
    return view;
};

const placeholders = () => screen.queryAllByRole("button");

beforeEach(() => {
    mockStatus.mockReset();
    // The real card, which shows the link-only card when the lookup fails.
    mockStatus.mockResolvedValue({ kind: "error" });
});

describe("LazyPrCard: the placeholder sends nothing", () => {
    it("several PR links send no request at mount", async () => {
        await mount([prUrl(1), prUrl(2), prUrl(3), prUrl(4)]);

        expect(placeholders()).toHaveLength(4);
        expect(mockStatus).not.toHaveBeenCalled();
    });

    it("each placeholder names its PR, in order, and is a card shell, not a link", async () => {
        await mount([prUrl(7), prUrl(2)]);

        expect(placeholders().map((p) => p.getAttribute("aria-label"))).toEqual([
            "acme/rocket #7",
            "acme/rocket #2",
        ]);
        expect(placeholders()[0].textContent).toContain("acme/rocket #7");
        // A click must load the card, not navigate away.
        expect(screen.queryAllByRole("link")).toHaveLength(0);
    });

    it("falls back to the URL when it is not a PR url", async () => {
        await mount(["https://github.com/acme/rocket/issues/7"]);

        expect(placeholders()[0].textContent).toContain("https://github.com/acme/rocket/issues/7");
    });
});

describe("LazyPrCard: hover, focus or click loads the real card", () => {
    it.each([
        ["hover", (el: HTMLElement) => fireEvent.mouseEnter(el)],
        ["focus", (el: HTMLElement) => fireEvent.focus(el)],
        ["click", (el: HTMLElement) => fireEvent.click(el)],
    ])("%s asks once for that PR and swaps the card into the same slot", async (_n, fire) => {
        await mount([prUrl(1), prUrl(2), prUrl(3)]);

        await act(async () => {
            fire(placeholders()[1]);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(mockStatus).toHaveBeenCalledWith("tok", prUrl(2));
        // The hovered placeholder is gone, replaced by the real card (here the
        // link-only card a failed lookup shows); the other two are untouched.
        expect(placeholders()).toHaveLength(2);
        expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([prUrl(2)]);
    });

    it("further events on the revealed card do not ask again", async () => {
        await mount([prUrl(1)]);

        await act(async () => {
            fireEvent.mouseEnter(placeholders()[0]);
        });
        const link = screen.getByRole("link");
        await act(async () => {
            fireEvent.mouseEnter(link);
            fireEvent.focus(link);
            fireEvent.click(link);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it("a user without GitHub connected sees the placeholder, and then nothing", async () => {
        mockStatus.mockResolvedValue({ kind: "github_not_connected" });
        const { container } = await mount([prUrl(1)], true);

        expect(placeholders()).toHaveLength(1);
        await act(async () => {
            fireEvent.mouseEnter(placeholders()[0]);
        });

        expect(container.textContent).toBe("");
    });

    it("without hideOnNotConnected, a user without GitHub gets the connect prompt", async () => {
        mockStatus.mockResolvedValue({ kind: "github_not_connected" });
        await mount([prUrl(1)], false);

        await act(async () => {
            fireEvent.mouseEnter(placeholders()[0]);
        });

        expect(screen.getByText("Connect GitHub to see PR status")).toBeTruthy();
    });
});
