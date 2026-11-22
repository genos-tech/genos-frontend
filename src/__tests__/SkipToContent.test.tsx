/**
 * MIP-1829: the app shell has a skip link to its routed content, reached by keyboard.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { APP_MAIN_ID, SkipToContent } from "../components/layout/SkipToContent";

const Shell = () => (
    <>
        <SkipToContent />
        <nav>
            <button type="button">Sidebar item</button>
        </nav>
        <div id={APP_MAIN_ID} tabIndex={-1}>
            <button type="button">Routed content</button>
        </div>
    </>
);

describe("SkipToContent", () => {
    it("is the first tab stop and links to the routed content", async () => {
        const user = userEvent.setup();
        render(<Shell />);
        await user.tab();
        const skip = screen.getByRole("link", { name: "Skip to content" });
        expect(document.activeElement).toBe(skip);
        expect(skip.getAttribute("href")).toBe(`#${APP_MAIN_ID}`);
    });

    it("Enter moves keyboard focus into the routed content", async () => {
        const user = userEvent.setup();
        render(<Shell />);
        await user.tab();
        await user.keyboard("{Enter}");
        expect(document.activeElement).toBe(document.getElementById(APP_MAIN_ID));
    });

    it("does not push a history entry: the hash stays empty (MIP-1928)", async () => {
        const user = userEvent.setup();
        window.location.hash = "";
        render(<Shell />);
        await user.tab();
        await user.keyboard("{Enter}");
        expect(window.location.hash).toBe("");
        expect(document.activeElement).toBe(document.getElementById(APP_MAIN_ID));
    });
});
