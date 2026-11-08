/**
 * The shared SearchField (MIP-1129): Escape clears a non-empty box and stops
 * there, an empty box lets Escape through (the modal closes), IME composition
 * owns Escape, the clear button has a localized name and keeps the focus, the
 * spinner slot shows while loading, the sizes are the control scale.
 */
import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchField } from "../components/ui/fields/SearchField";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

afterEach(cleanup);

const Harness = ({
    initial = "",
    onOuterKey,
    onChangeSpy,
    ...rest
}: {
    initial?: string;
    onOuterKey?: (key: string) => void;
    onChangeSpy?: (v: string) => void;
} & Partial<React.ComponentProps<typeof SearchField>>) => {
    const [value, setValue] = useState(initial);
    return (
        <CssVarsProvider>
            <div onKeyDown={(e) => onOuterKey?.(e.key)}>
                <SearchField
                    ariaLabel="Find a member"
                    placeholder="Search members"
                    value={value}
                    onChange={(v) => {
                        setValue(v);
                        onChangeSpy?.(v);
                    }}
                    {...rest}
                />
            </div>
        </CssVarsProvider>
    );
};

const input = () => screen.getByRole("searchbox", { name: "Find a member" }) as HTMLInputElement;

describe("SearchField", () => {
    it("types through onChange", () => {
        const spy = vi.fn();
        render(<Harness onChangeSpy={spy} />);
        fireEvent.change(input(), { target: { value: "ken" } });
        expect(spy).toHaveBeenLastCalledWith("ken");
        expect(input().value).toBe("ken");
    });

    it("shows the clear button only when there is text, named in the user's language", () => {
        render(<Harness />);
        expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
        fireEvent.change(input(), { target: { value: "k" } });
        expect(screen.getByRole("button", { name: "Clear search" })).toBeTruthy();
    });

    it("the clear button empties the field and keeps the focus in it", () => {
        const onClear = vi.fn();
        render(<Harness initial="ken" onClear={onClear} />);
        fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
        expect(input().value).toBe("");
        expect(document.activeElement).toBe(input());
        expect(onClear).toHaveBeenCalledTimes(1);
    });

    it("pressing the clear button does not blur the field first", () => {
        render(<Harness initial="ken" />);
        const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
        screen.getByRole("button", { name: "Clear search" }).dispatchEvent(down);
        expect(down.defaultPrevented).toBe(true);
    });

    it("Escape on a non-empty field clears it and does NOT reach the surface around it", () => {
        const outer = vi.fn();
        render(<Harness initial="ken" onOuterKey={outer} />);
        fireEvent.keyDown(input(), { key: "Escape" });
        expect(input().value).toBe("");
        expect(outer).not.toHaveBeenCalled();
    });

    it("other keys never clear the field", () => {
        render(<Harness initial="ken" />);
        for (const key of ["Enter", "a", "ArrowDown", "Backspace"]) {
            fireEvent.keyDown(input(), { key });
        }
        expect(input().value).toBe("ken");
    });

    it("Escape on an EMPTY field is left alone, so the modal around it can close", () => {
        const outer = vi.fn();
        render(<Harness onOuterKey={outer} />);
        fireEvent.keyDown(input(), { key: "Escape" });
        expect(outer).toHaveBeenCalledWith("Escape");
    });

    it("Escape during an IME composition does not clear (it cancels the candidate)", () => {
        render(<Harness initial="にほ" />);
        fireEvent.keyDown(input(), { key: "Escape", isComposing: true });
        expect(input().value).toBe("にほ");
        fireEvent.keyDown(input(), { key: "Escape", keyCode: 229 });
        expect(input().value).toBe("にほ");
    });

    it("a host onKeyDown that prevents default keeps Escape from clearing", () => {
        render(<Harness initial="ken" onKeyDown={(e) => e.preventDefault()} />);
        fireEvent.keyDown(input(), { key: "Escape" });
        expect(input().value).toBe("ken");
    });

    it("loading shows the spinner slot before the clear button", () => {
        render(<Harness initial="ken" loading />);
        expect(screen.getByRole("progressbar")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Clear search" })).toBeTruthy();
    });

    it("no spinner when not loading", () => {
        render(<Harness initial="ken" />);
        expect(screen.queryByRole("progressbar")).toBeNull();
    });

    it("reads its direction from the text (dir=auto) and is a search input", () => {
        render(<Harness />);
        expect(input().getAttribute("dir")).toBe("auto");
        expect(input().type).toBe("search");
    });

    it("the clear label can be overridden", () => {
        render(<Harness clearLabel="Reset the filter" initial="x" />);
        expect(screen.getByRole("button", { name: "Reset the filter" })).toBeTruthy();
    });

    it("sizes are the control scale (sm 28, md 32, lg 36)", () => {
        for (const size of ["sm", "md", "lg"] as const) {
            render(<Harness size={size} />);
            cleanup();
        }
        // Emotion writes the variable into a class rule: it names the token, not a literal.
        const css = Array.from(document.querySelectorAll("style"))
            .map((s) => s.textContent)
            .join("");
        expect(css).toContain("--Input-minHeight:var(--g-control-sm)");
        expect(css).toContain("--Input-minHeight:var(--g-control-md)");
        expect(css).toContain("--Input-minHeight:var(--g-control-lg)");
    });
});

describe("SearchField strings", () => {
    const catalogs = { ja, zh, es, fr, ar, hi } as const;
    it("the clear label exists in all 7 locales and is translated", () => {
        expect(en.common.searchField.clear).toBe("Clear search");
        for (const [name, c] of Object.entries(catalogs)) {
            const value = (c as { common?: { searchField?: { clear?: string } } }).common
                ?.searchField?.clear;
            expect(value, name).toBeTruthy();
            expect(value, name).not.toBe(en.common.searchField.clear);
        }
    });
});
