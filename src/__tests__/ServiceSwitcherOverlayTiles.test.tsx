/**
 * MIP-1044: the switcher overlay has a To-Do tile, and its tiles answer to the
 * pointer (hover moves the highlight, a click switches) while the overlay is up.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceSwitcherOverlay } from "../components/layout/ServiceSwitcherOverlay";

afterEach(cleanup);

// Tasks is current; To-Do is the last stop.
const MRU = [2, 0, 1, 3, 4, 5];

const renderOverlay = (over: Partial<Parameters<typeof ServiceSwitcherOverlay>[0]> = {}) => {
    const onHighlight = vi.fn();
    const onSelect = vi.fn();
    render(
        <CssVarsProvider>
            <ServiceSwitcherOverlay
                previewIndex={1}
                mruOrder={MRU}
                onHighlight={onHighlight}
                onSelect={onSelect}
                {...over}
            />
        </CssVarsProvider>
    );
    return { onHighlight, onSelect };
};

const tile = (label: string) =>
    screen.getByText(label).closest("[data-service-tile]") as HTMLElement;

describe("ServiceSwitcherOverlay tiles", () => {
    it("shows all six stops, To-Do last, labelled", () => {
        renderOverlay();
        const labels = Array.from(document.querySelectorAll("[data-service-tile]")).map(
            (el) => el.textContent
        );
        expect(labels).toEqual(["Tasks", "Inbox", "Chats", "Notes", "Genos", "To-Do"]);
    });

    it("is hidden while there is no preview", () => {
        renderOverlay({ previewIndex: null });
        expect(document.querySelectorAll("[data-service-tile]")).toHaveLength(0);
    });

    it("a click on a tile selects that position", () => {
        const { onSelect } = renderOverlay();
        fireEvent.click(tile("Notes"));
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith(3);
        fireEvent.click(tile("To-Do"));
        expect(onSelect).toHaveBeenLastCalledWith(5);
    });

    it("real pointer movement over a tile highlights it", () => {
        const { onHighlight } = renderOverlay();
        fireEvent.mouseMove(tile("Chats"), { movementX: 3, movementY: 0 });
        expect(onHighlight).toHaveBeenCalledWith(2);
    });

    it("a mouseenter or a motionless mousemove (the overlay appearing under a still pointer) highlights nothing", () => {
        const { onHighlight } = renderOverlay();
        fireEvent.mouseEnter(tile("Chats"));
        fireEvent.mouseOver(tile("Chats"));
        fireEvent.mouseMove(tile("Chats"), { movementX: 0, movementY: 0 });
        expect(onHighlight).not.toHaveBeenCalled();
    });

    it("the sheet takes pointer events, but the full-screen layer around it does not", () => {
        renderOverlay();
        const sheet = tile("Tasks").parentElement!.parentElement as HTMLElement;
        const layer = sheet.parentElement as HTMLElement;
        expect(getComputedStyle(layer).pointerEvents).toBe("none");
        expect(getComputedStyle(sheet).pointerEvents).toBe("auto");
    });
});
