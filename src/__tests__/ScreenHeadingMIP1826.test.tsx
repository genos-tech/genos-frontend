import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ScreenHeading } from "../components/layout/ScreenHeading";

const at = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <ScreenHeading />
        </MemoryRouter>
    );

describe("ScreenHeading (MIP-1826)", () => {
    it("gives each section screen an h1 and a matching document title", () => {
        document.title = "Genos";
        const { unmount } = at("/workspace/notes/5");
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Notes");
        expect(document.title).toBe("Notes | Genos");
        unmount();
        expect(document.title).toBe("Genos");
    });

    it("adds no heading where the screen draws its own (inbox) or on an unknown path", () => {
        at("/workspace/inbox/activities");
        expect(screen.queryByRole("heading")).toBeNull();
    });
});
