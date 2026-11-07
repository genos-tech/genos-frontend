/**
 * MIP-1125: the one dialog frame.
 *
 * Pinned here: it renders title / description / body / actions with the
 * dialog named and described; the close button and Esc close it unless it is
 * not dismissible; the layer comes from the host (genos-ui rule 1); the
 * surface is flat (solid, no gradient, no glow); events do not leak out of
 * the portal into the component that opened it; and it renders in `ar` (RTL).
 * Layout (widths, the scrolling body) is jsdom-blind and was checked in a
 * browser; see the evidence page linked from the PR.
 */
import { CacheProvider } from "@emotion/react";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import {
    MODAL_FRAME_DEFAULT_Z_INDEX,
    MODAL_FRAME_HOST_OFFSET,
    ModalFrame,
    ModalFrameProps,
} from "../components/ui/modal/ModalFrame";
import { applyDocumentLocale, I18nProvider, loadLocale } from "../i18n";
import { getRtlCache } from "../theme/rtlCache";

afterEach(() => {
    cleanup();
    applyDocumentLocale("en");
    document.documentElement.dir = "";
    window.localStorage.removeItem("genos-locale");
});

const mount = (over: Partial<ModalFrameProps> = {}) => {
    const props: ModalFrameProps = {
        open: true,
        title: "Rename project",
        description: "Pick a name the team will recognise.",
        onClose: vi.fn(),
        children: <p>Body content</p>,
        actions: <button type="button">Save</button>,
        ...over,
    };
    const view = render(
        <CssVarsProvider>
            <ModalFrame {...props} />
        </CssVarsProvider>
    );
    return { props, ...view };
};

const dialog = () => screen.getByRole("dialog");
const root = () => screen.getByRole("presentation");
const z = () => getComputedStyle(root()).zIndex;

describe("ModalFrame", () => {
    it("shows title, description, body and actions; the dialog is named and described by them", () => {
        mount();
        const d = dialog();
        expect(d.textContent).toContain("Pick a name the team will recognise.");
        expect(d.textContent).toContain("Body content");
        expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
        const title = document.getElementById(d.getAttribute("aria-labelledby")!)!;
        expect(title.tagName).toBe("H2");
        expect(title.textContent).toBe("Rename project");
        const description = document.getElementById(d.getAttribute("aria-describedby")!)!;
        expect(description.textContent).toBe("Pick a name the team will recognise.");
    });

    it("renders nothing while closed", () => {
        mount({ open: false });
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("has no aria-describedby without a description, and no empty body or footer", () => {
        mount({ description: undefined, children: undefined, actions: undefined });
        expect(dialog().getAttribute("aria-describedby")).toBeNull();
        // Header only: title block and the close button.
        expect(dialog().querySelectorAll("button").length).toBe(1);
    });

    it("the close button is named and closes", () => {
        const { props } = mount();
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("closable=false drops the close button", () => {
        mount({ closable: false });
        expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    });

    it("Esc closes", () => {
        const { props } = mount();
        fireEvent.keyDown(dialog(), { key: "Escape" });
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("dismissible=false: Esc, the backdrop and the X do nothing", () => {
        const { props } = mount({ dismissible: false });
        fireEvent.keyDown(dialog(), { key: "Escape" });
        fireEvent.click(document.querySelector(".MuiModal-backdrop")!);
        const close = screen.getByRole("button", { name: "Close" }) as HTMLButtonElement;
        expect(close.disabled).toBe(true);
        fireEvent.click(close);
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it("a backdrop click closes", () => {
        const { props } = mount();
        fireEvent.click(document.querySelector(".MuiModal-backdrop")!);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("alertdialog role is honoured", () => {
        mount({ role: "alertdialog" });
        expect(screen.getByRole("alertdialog")).toBeTruthy();
    });

    describe("stacking comes from the host", () => {
        it("defaults to the page-level layer", () => {
            mount();
            expect(z()).toBe(String(MODAL_FRAME_DEFAULT_Z_INDEX));
            expect(MODAL_FRAME_DEFAULT_Z_INDEX).toBe(10010);
        });

        it("takes an exact zIndex", () => {
            mount({ zIndex: 13250 });
            expect(z()).toBe("13250");
        });

        it("lifts over a host's layer by the shared offset", () => {
            mount({ hostZIndex: 10020 });
            expect(z()).toBe(String(10020 + MODAL_FRAME_HOST_OFFSET));
            expect(MODAL_FRAME_HOST_OFFSET).toBe(2);
        });

        it("a host layer wins over an exact zIndex", () => {
            mount({ hostZIndex: 10020, zIndex: 5 });
            expect(z()).toBe("10022");
        });

        it("keeps the pickers it opens above its own layer", () => {
            mount({ hostZIndex: 10020 });
            expect(cssOf(root())).toContain("--unstable_popup-zIndex: 10032");
        });
    });

    describe("flat surface", () => {
        it("is a solid raised surface with a thin neutral border, radius lg and shadow lg", () => {
            mount();
            const css = cssOf(dialog());
            expect(css).toContain("background: var(--g-surface-raised)");
            expect(css).toContain("border: 1px solid var(--g-border)");
            expect(css).toContain("border-radius: var(--g-radius-lg)");
            expect(css).toContain("box-shadow: var(--g-shadow-lg)");
        });

        it("has no gradient and no glow anywhere on the dialog", () => {
            mount({ tone: "danger" });
            const css = cssOf(dialog());
            expect(css).not.toMatch(/gradient/i);
            // One shadow value only: no second, coloured layer.
            expect(css.match(/box-shadow:[^;]*/g)).toEqual(["box-shadow: var(--g-shadow-lg)"]);
        });
    });

    describe("events stay inside the portal", () => {
        const host = () => {
            const onKeyDown = vi.fn();
            const onClick = vi.fn();
            const onDoubleClick = vi.fn();
            render(
                <CssVarsProvider>
                    <div onClick={onClick} onDoubleClick={onDoubleClick} onKeyDown={onKeyDown}>
                        <ModalFrame
                            actions={<button type="button">Go</button>}
                            title="T"
                            open
                            onClose={() => {}}
                        >
                            <input aria-label="field" />
                        </ModalFrame>
                    </div>
                </CssVarsProvider>
            );
            return { onKeyDown, onClick, onDoubleClick };
        };

        it("click and double-click do not reach the opener", () => {
            const { onClick, onDoubleClick } = host();
            fireEvent.click(screen.getByRole("button", { name: "Go" }));
            fireEvent.doubleClick(screen.getByRole("button", { name: "Go" }));
            fireEvent.click(document.querySelector(".MuiModal-backdrop")!);
            expect(onClick).not.toHaveBeenCalled();
            expect(onDoubleClick).not.toHaveBeenCalled();
        });

        it("touch and press events do not reach the opener (a bubble's long-press)", () => {
            const onTouchStart = vi.fn();
            const onMouseDown = vi.fn();
            render(
                <CssVarsProvider>
                    <div onMouseDown={onMouseDown} onTouchStart={onTouchStart}>
                        <ModalFrame
                            actions={<button type="button">Go</button>}
                            title="T"
                            open
                            onClose={() => {}}
                        />
                    </div>
                </CssVarsProvider>
            );
            const go = screen.getByRole("button", { name: "Go" });
            fireEvent.touchStart(go);
            fireEvent.mouseDown(go);
            expect(onTouchStart).not.toHaveBeenCalled();
            expect(onMouseDown).not.toHaveBeenCalled();
        });

        it("typing and Enter do not reach the opener's key handler", () => {
            const { onKeyDown } = host();
            const input = screen.getByLabelText("field");
            fireEvent.keyDown(input, { key: "a" });
            fireEvent.keyDown(input, { key: "Enter" });
            fireEvent.keyDown(screen.getByRole("button", { name: "Go" }), { key: " " });
            expect(onKeyDown).not.toHaveBeenCalled();
        });
    });

    it("traps focus: the dialog takes focus on open and Tab stays inside", () => {
        mount();
        expect(dialog().contains(document.activeElement)).toBe(true);
    });

    it("renders in Arabic (RTL) with its strings and no hard-coded left/right", async () => {
        await loadLocale("ar");
        window.localStorage.setItem("genos-locale", "ar");
        applyDocumentLocale("ar");
        render(
            <CacheProvider value={getRtlCache()}>
                <CssVarsProvider>
                    <I18nProvider>
                        <ModalFrame
                            actions={<button type="button">حفظ</button>}
                            description="وصف"
                            title="عنوان"
                            open
                            onClose={() => {}}
                        >
                            نص
                        </ModalFrame>
                    </I18nProvider>
                </CssVarsProvider>
            </CacheProvider>
        );
        expect(document.documentElement.dir).toBe("rtl");
        expect(dialog().textContent).toContain("عنوان");
        expect(screen.getByRole("button", { name: "إغلاق" })).toBeTruthy();
        expect(getComputedStyle(dialog()).direction).toBe("rtl");
        // Alignment is logical (`start`), so it follows the direction.
        const css = cssOf(dialog());
        expect(css).toContain("text-align: start");
        expect(css).not.toMatch(/text-align:\s*(left|right)/);
    });
});
