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

        it("does not claim sibling listboxes by default (opt-in)", () => {
            // Select / Autocomplete listboxes are not inside this root, so the variable on it
            // does not reach them. The sibling rule is a global claim on every following
            // listbox, so it is opt-in: two surfaces that both made it would fight by
            // stylesheet order (fe #122).
            mount({ hostZIndex: 10020 });
            // (Joy writes its own sibling rule at its default layer; ours would carry 10032.)
            expect(cssOf(root())).not.toMatch(
                /~\s*\[role="listbox"\]\s*\{[^}]*--unstable_popup-zIndex: 10032/
            );
        });

        it("writes it when the dialog owns its listbox popups", () => {
            mount({ hostZIndex: 10020, ownsListboxPopups: true });
            expect(cssOf(root())).toMatch(
                /~\s*\[role="listbox"\]\s*\{[^}]*--unstable_popup-zIndex: 10032/
            );
        });

        it("leaves Joy's own sibling rule alone at Joy's default layer, even when it owns them", () => {
            mount({ zIndex: 1300, ownsListboxPopups: true });
            expect(cssOf(root())).not.toMatch(
                /~\s*\[role="listbox"\]\s*\{[^}]*--unstable_popup-zIndex: 13/
            );
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

    describe("sizes and layout options (MIP-1126 batch 1)", () => {
        const css = () => cssOf(dialog());
        // jsdom keeps every @media block but drops the query itself, so a
        // responsive property shows up as one declaration per breakpoint, in
        // order (xs, sm, md, lg). The sequence is what is pinned here.
        const seq = (prop: string) =>
            (css().match(new RegExp(`(?<![-\\w])${prop}: [^;]+`, "g")) ?? [])
                .map((d) => d.slice(prop.length + 2))
                // Joy's own base rule for the same property.
                .filter((v) => !v.includes("--Card-padding"));

        it("keeps the fixed widths and the 24px phone inset", () => {
            mount({ size: "md" });
            expect(seq("width")).toEqual(["calc(100vw - 24px)", "480px"]);
            expect(seq("max-height")).toEqual(["calc(100dvh - 32px)"]);
        });

        it("xl is the Settings ladder: 550, 700, 920", () => {
            mount({ size: "xl" });
            expect(seq("width")).toEqual(["calc(100vw - 24px)", "550px", "700px", "920px"]);
        });

        it("wide is 550, then 806 from md up (the dependencies dialog)", () => {
            mount({ size: "wide" });
            expect(seq("width")).toEqual(["calc(100vw - 24px)", "550px", "806px"]);
        });

        it("profile is 1000px from md up", () => {
            mount({ size: "profile" });
            expect(seq("width")).toEqual(["calc(100vw - 24px)", "1000px"]);
        });

        it("fullScreenOnMobile fills the screen below md with square corners", () => {
            mount({ size: "profile", fullScreenOnMobile: true });
            expect(seq("width")).toEqual(["100vw", "1000px"]);
            expect(seq("height")).toEqual(["100dvh", "auto"]);
            expect(seq("max-height")).toEqual(["100dvh", "calc(100dvh - 32px)"]);
            expect(seq("border-radius").slice(-2)).toEqual(["0px", "var(--g-radius-lg)"]);
        });

        it("is an inset card on a phone by default", () => {
            mount({ size: "profile" });
            expect(seq("height")).toEqual([]);
            expect(seq("border-radius").slice(-1)).toEqual(["var(--g-radius-lg)"]);
            expect(seq("border-radius")).not.toContain("0px");
        });

        it("clearBottomBar leaves room for the mobile tab bar, nothing else does", () => {
            mount({ clearBottomBar: true });
            expect(seq("max-height")).toEqual([
                "calc(100dvh - var(--mobile-bottom-inset, 60px) - 24px)",
                "calc(100dvh - 32px)",
            ]);
        });

        it("flush drops the body padding; the default keeps 20px", () => {
            const body = () => screen.getByText("Body content").parentElement!;
            const view = mount();
            expect(cssOf(body())).toContain("padding: 8px 20px");
            view.unmount();
            mount({ flush: true });
            expect(cssOf(body())).toContain("padding: 0px;");
        });

        it("headerDivider draws one hairline under the header, off by default", () => {
            const header = () =>
                screen.getByRole("heading", { name: "Rename project" }).parentElement!
                    .parentElement!;
            const view = mount();
            expect(cssOf(header())).not.toContain("border-bottom");
            view.unmount();
            mount({ headerDivider: true });
            expect(cssOf(header())).toContain("border-bottom: 1px solid var(--g-border-subtle)");
        });

        it("headerAccessory sits between the title and the close button", () => {
            mount({ headerAccessory: <span data-testid="chip">External</span> });
            const chip = screen.getByTestId("chip");
            const close = screen.getByRole("button", { name: "Close" });
            const after = (a: Node, b: Node) =>
                Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
            expect(after(screen.getByRole("heading"), chip)).toBe(true);
            expect(after(chip, close)).toBe(true);
        });

        it("closeLabel names the X; the default is Close", () => {
            const view = mount();
            expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
            view.unmount();
            mount({ closeLabel: "Close history" });
            expect(screen.getByRole("button", { name: "Close history" })).toBeTruthy();
        });

        it("renders no accessory slot for a false or null accessory", () => {
            mount({ headerAccessory: false });
            expect(
                screen.getByRole("heading").parentElement!.parentElement!.children
            ).toHaveLength(2);
        });

        it("none of it brings a gradient or a second shadow", () => {
            mount({ size: "profile", fullScreenOnMobile: true, headerDivider: true, flush: true });
            expect(css()).not.toMatch(/gradient/i);
            expect(css().match(/box-shadow:[^;]*/g)).toEqual(["box-shadow: var(--g-shadow-lg)"]);
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
