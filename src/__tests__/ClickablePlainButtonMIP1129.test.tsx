/**
 * Clickable and PlainButton (MIP-1129): the replacements for a clickable Box.
 * Enter and Space activate, a key pressed in a control INSIDE the region does not,
 * an inert region (no handler) is not in the tab order, disabled is announced.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Clickable } from "../components/ui/Clickable";
import { PlainButton } from "../components/ui/PlainButton";

afterEach(cleanup);

describe("Clickable", () => {
    it("is a button in the tab order with the given name; a click activates", () => {
        const onActivate = vi.fn();
        render(
            <Clickable label="Open task" onActivate={onActivate}>
                <span>TP-1</span>
            </Clickable>
        );
        const el = screen.getByRole("button", { name: "Open task" });
        expect(el.tabIndex).toBe(0);
        fireEvent.click(el);
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("Enter and Space on the region activate it (and do not scroll the page)", () => {
        const onActivate = vi.fn();
        render(<Clickable onActivate={onActivate}>row</Clickable>);
        const el = screen.getByRole("button");
        const enter = fireEvent.keyDown(el, { key: "Enter" });
        const space = fireEvent.keyDown(el, { key: " " });
        expect(onActivate).toHaveBeenCalledTimes(2);
        // preventDefault ran: fireEvent returns false for a cancelled event.
        expect(enter).toBe(false);
        expect(space).toBe(false);
        fireEvent.keyDown(el, { key: "a" });
        expect(onActivate).toHaveBeenCalledTimes(2);
    });

    it("keys={['Enter']} leaves Space to a drag handle", () => {
        const onActivate = vi.fn();
        render(
            <Clickable keys={["Enter"]} onActivate={onActivate}>
                card
            </Clickable>
        );
        const el = screen.getByRole("button");
        const space = fireEvent.keyDown(el, { key: " " });
        expect(onActivate).not.toHaveBeenCalled();
        // Not cancelled: the drag library still sees an uncancelled Space.
        expect(space).toBe(true);
        fireEvent.keyDown(el, { key: "Enter" });
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("a key pressed in a control inside the region belongs to that control", () => {
        const onActivate = vi.fn();
        render(
            <Clickable onActivate={onActivate}>
                <a href="#x">link</a>
                <input aria-label="inner" />
            </Clickable>
        );
        fireEvent.keyDown(screen.getByRole("link"), { key: "Enter" });
        fireEvent.keyDown(screen.getByLabelText("inner"), { key: " " });
        expect(onActivate).not.toHaveBeenCalled();
    });

    it("without a handler it is inert: no role, not in the tab order", () => {
        const { container } = render(<Clickable>plain</Clickable>);
        const el = container.firstElementChild as HTMLElement;
        expect(el.getAttribute("role")).toBeNull();
        expect(el.getAttribute("tabindex")).toBeNull();
        fireEvent.keyDown(el, { key: "Enter" });
    });

    it("disabled: announced, out of the tab order, never activates", () => {
        const onActivate = vi.fn();
        render(
            <Clickable disabled onActivate={onActivate}>
                x
            </Clickable>
        );
        const el = screen.getByRole("button");
        expect(el.getAttribute("aria-disabled")).toBe("true");
        expect(el.tabIndex).toBe(-1);
        fireEvent.click(el);
        fireEvent.keyDown(el, { key: "Enter" });
        expect(onActivate).not.toHaveBeenCalled();
    });

    it("`as=span` keeps an inline run inline", () => {
        render(
            <p>
                see{" "}
                <Clickable as="span" onActivate={() => {}}>
                    #TP-1
                </Clickable>
            </p>
        );
        expect(screen.getByRole("button").tagName).toBe("SPAN");
    });

    it("a caller's role (a checkbox row) wins and keeps the keyboard", () => {
        const onActivate = vi.fn();
        render(
            <Clickable role="checkbox" aria-checked onActivate={onActivate}>
                member
            </Clickable>
        );
        const el = screen.getByRole("checkbox");
        fireEvent.keyDown(el, { key: " " });
        expect(onActivate).toHaveBeenCalledTimes(1);
    });
});

describe("PlainButton", () => {
    it("is a real, non-submitting button", () => {
        const onClick = vi.fn();
        render(
            <form>
                <PlainButton aria-label="Pick" onClick={onClick}>
                    tile
                </PlainButton>
            </form>
        );
        const el = screen.getByRole("button", { name: "Pick" }) as HTMLButtonElement;
        expect(el.tagName).toBe("BUTTON");
        expect(el.type).toBe("button");
        fireEvent.click(el);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("disabled does not fire", () => {
        const onClick = vi.fn();
        render(
            <PlainButton disabled onClick={onClick}>
                x
            </PlainButton>
        );
        fireEvent.click(screen.getByRole("button"));
        expect(onClick).not.toHaveBeenCalled();
    });

    it("draws the shared focus ring on :focus-visible only", () => {
        render(<PlainButton>x</PlainButton>);
        const css = Array.from(document.querySelectorAll("style"))
            .map((s) => s.textContent)
            .join("");
        expect(css).toMatch(/:focus-visible\{[^}]*outline:2px solid var\(--g-focus\)/);
    });
});
