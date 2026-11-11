/**
 * The four feedback primitives (MIP-1132): EmptyState, Skeleton, the toast
 * host and TabStrip. These pin the contract the app now relies on: a toast
 * is announced, hovering it pauses its timer, Undo runs once, a tab strip is
 * a real tablist that follows the arrow keys (mirrored in RTL).
 */
import { Modal, ModalDialog } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionStatusSnackbar } from "../components/layout/ConnectionStatusSnackbar";
import { IdleReloadSnackbar } from "../components/layout/IdleReloadSnackbar";
import { EmptyState } from "../components/ui/feedback/EmptyState";
import { SkeletonLines, SkeletonRows, Spinner } from "../components/ui/feedback/Skeleton";
import { TabItem, TabStrip } from "../components/ui/feedback/TabStrip";
import { Toast, ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts, MAX_VISIBLE, toast } from "../components/ui/feedback/toastStore";
import { getMessages, I18nProvider, loadLocale } from "../i18n";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

const wrap = (ui: React.ReactNode) => <CssVarsProvider>{ui}</CssVarsProvider>;

afterEach(() => {
    cleanup();
    __resetToasts();
    document.getElementById("genos-toast-region")?.remove();
    document.getElementById("genos-banner-region")?.remove();
    // The Arabic test switches the document to RTL; later tests must not inherit it.
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
    vi.useRealTimers();
});

describe("EmptyState", () => {
    it("shows the title, the next step and one action that fires", () => {
        const onClick = vi.fn();
        render(
            wrap(
                <EmptyState
                    action={{ label: "New note", onClick }}
                    body="Pick a note, or start a new one."
                    icon={<span data-testid="ic" />}
                    title="No note open"
                />
            )
        );
        expect(screen.getByText("No note open")).toBeTruthy();
        expect(screen.getByText("Pick a note, or start a new one.")).toBeTruthy();
        expect(screen.getByTestId("ic")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "New note" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("a body-only hint (no title) shows the sentence, not an empty heading", () => {
        render(wrap(<EmptyState body="No tags yet. Add one below." size="sm" />));
        expect(screen.getByText("No tags yet. Add one below.")).toBeTruthy();
        // No heading element is rendered for a missing title.
        expect(
            document.querySelectorAll(".MuiTypography-title-sm, .MuiTypography-title-md").length
        ).toBe(0);
    });

    it("xs is one start-aligned line, with its action when given", () => {
        const onClick = vi.fn();
        const { container } = render(
            wrap(
                <EmptyState
                    action={{ label: "Create", onClick }}
                    body="No schedules yet."
                    data-empty="xs-case"
                    icon={<span data-testid="ic" />}
                    size="xs"
                />
            )
        );
        expect(screen.getByText("No schedules yet.")).toBeTruthy();
        // xs never draws the icon disc.
        expect(screen.queryByTestId("ic")).toBeNull();
        expect(container.querySelector('[data-empty="xs-case"]')).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Create" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("renders no button and no icon disc when none are given", () => {
        render(wrap(<EmptyState title="No tasks" />));
        expect(screen.queryByRole("button")).toBeNull();
        expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
    });
});

describe("Skeleton", () => {
    it("announces once as Loading and draws the requested rows", () => {
        render(wrap(<SkeletonRows count={4} avatar />));
        const status = screen.getByRole("status", { name: getMessages().common.feedback.loading });
        expect(status.getAttribute("aria-busy")).toBe("true");
        // 4 rows x (avatar + 1 line)
        expect(status.querySelectorAll(".MuiSkeleton-root").length).toBe(8);
    });

    it("lines and the inline spinner carry the same accessible name", () => {
        const loading = getMessages().common.feedback.loading;
        render(
            wrap(
                <>
                    <SkeletonLines lines={2} />
                    <Spinner />
                </>
            )
        );
        expect(screen.getByRole("status", { name: loading })).toBeTruthy();
        // A spinner is an indeterminate progressbar, named the same way.
        expect(screen.getByRole("progressbar", { name: loading })).toBeTruthy();
    });

    it("a captioned spinner is one 'status' named by its words, the ring is hidden (page / AI waits)", () => {
        render(wrap(<Spinner caption="Finishing sign-in" size="lg" stacked />));
        const status = screen.getByRole("status");
        expect(status.textContent).toBe("Finishing sign-in");
        // The ring is decoration once a caption says it in words (read once, not three times).
        expect(screen.queryByRole("progressbar")).toBeNull();
        expect(document.querySelector('[role="progressbar"]')?.getAttribute("aria-hidden")).toBe(
            "true"
        );
    });

    it("the spinner sizes map to 12 / 16 / 24 / 40 px", () => {
        for (const [size, want] of [
            ["xs", "12px"],
            ["sm", "16px"],
            ["md", "24px"],
            ["lg", "40px"],
        ] as const) {
            const { container, unmount } = render(wrap(<Spinner size={size} />));
            const el = container.querySelector('[role="progressbar"]') as HTMLElement;
            expect(getComputedStyle(el).getPropertyValue("--CircularProgress-size")).toBe(want);
            unmount();
        }
    });
});

describe("toast host", () => {
    it("is a named region with an empty polite lane and an empty assertive lane, created once", () => {
        render(wrap(<ToastHost />));
        render(wrap(<Toast open>hello</Toast>));
        const regions = document.querySelectorAll("#genos-toast-region");
        expect(regions).toHaveLength(1);
        // Never a live region inside a live region: the lanes are the live ones.
        expect(regions[0].hasAttribute("aria-live")).toBe(false);
        expect(
            regions[0].querySelector('[data-toast-lane="status"]')?.getAttribute("aria-live")
        ).toBe("polite");
        expect(
            regions[0].querySelector('[data-toast-lane="alert"]')?.getAttribute("aria-live")
        ).toBe("assertive");
        expect(regions[0].getAttribute("role")).toBe("region");
        expect(regions[0].getAttribute("aria-label")).toBe(
            getMessages().common.feedback.toast.region
        );
        expect(regions[0].textContent).toContain("hello");
    });

    it("sits in one place: bottom-center, above the Spotlight layer and the phone tab bar", () => {
        render(wrap(<ToastHost />));
        const style = document.getElementById("genos-toast-region")!.style;
        expect(style.position).toBe("fixed");
        // Centred by two equal insets, not left:50% (MIP-1196).
        expect(style.left).toBe("16px");
        expect(style.right).toBe("16px");
        expect(style.bottom).toContain("16px");
        // On a phone the tab bar (or the keyboard) is reserved, not covered.
        expect(style.bottom).toContain("--mobile-bottom-inset");
        expect(Number(style.zIndex)).toBeGreaterThan(13300);
    });

    it("both regions are sized by side insets, not centred with left:50% (MIP-1196)", () => {
        render(
            wrap(
                <>
                    <Toast duration={null} open placement="top" tone="danger">
                        Connection lost
                    </Toast>
                    <Toast open>Saved</Toast>
                </>
            )
        );
        for (const id of ["genos-banner-region", "genos-toast-region"]) {
            const { style } = document.getElementById(id)!;
            // 16px inside both edges, never `left: 50%` / translateX / a vw-based width,
            // which move with whatever box the region is centred on.
            expect(style.left, id).toBe("16px");
            expect(style.right, id).toBe("16px");
            expect(style.maxWidth, id).toBe("440px");
            expect(style.transform, id).toBe("");
            expect(style.width, id).toBe("");
        }
    });

    it("pins a persistent state banner at the TOP, clear of the composer (MIP-1171)", () => {
        render(
            wrap(
                <>
                    <Toast duration={null} open placement="top" tone="danger">
                        Connection lost
                    </Toast>
                    <Toast open>Saved</Toast>
                </>
            )
        );
        const banner = document.getElementById("genos-banner-region")!;
        const bottom = document.getElementById("genos-toast-region")!;
        expect(banner.textContent).toContain("Connection lost");
        expect(bottom.textContent).not.toContain("Connection lost");
        expect(bottom.textContent).toContain("Saved");
        // Top-anchored, never bottom-anchored, and still above the Spotlight layer.
        expect(banner.style.top).toContain("12px");
        expect(banner.style.bottom).toBe("");
        expect(Number(banner.style.zIndex)).toBeGreaterThan(13300);
        // A failure is still announced assertively, in the banner region's own lane.
        expect(
            banner
                .querySelector("[data-toast-tone]")
                ?.closest("[aria-live]")
                ?.getAttribute("aria-live")
        ).toBe("assertive");
    });

    it("a top banner lets taps through to the header under it; only its own buttons catch them (MIP-1327)", () => {
        render(
            wrap(
                <>
                    <Toast duration={null} open placement="top" tone="danger" dismissible={false}>
                        Connection lost
                    </Toast>
                    <Toast
                        action={{ label: "Retry", onClick: () => {} }}
                        duration={null}
                        open
                        placement="top"
                        tone="warning"
                    >
                        Could not sync
                    </Toast>
                    <Toast open>Saved</Toast>
                </>
            )
        );
        const cardOf = (text: string) => screen.getByText(text).closest("[data-toast-tone]")!;
        const events = (el: Element) => getComputedStyle(el).pointerEvents;
        // The passive banner never intercepts a tap.
        expect(events(cardOf("Connection lost"))).toBe("none");
        // The sync banner's card is see-through to taps too, but Retry and close are not.
        expect(events(cardOf("Could not sync"))).toBe("none");
        expect(events(screen.getByRole("button", { name: "Retry" }))).toBe("auto");
        expect(events(cardOf("Could not sync").querySelector("button:last-of-type")!)).toBe(
            "auto"
        );
        // A bottom toast stays interactive (hover pauses the timer).
        expect(events(cardOf("Saved"))).toBe("auto");
    });

    it("puts the connection and idle-reload banners in the top region", () => {
        render(
            wrap(
                <I18nProvider>
                    <ConnectionStatusSnackbar showApiDown showWsDisconnected />
                    <IdleReloadSnackbar open />
                </I18nProvider>
            )
        );
        const banner = document.getElementById("genos-banner-region")!;
        const { wsLost, idleReload } = getMessages().app.snackbar;
        expect(banner.textContent).toContain(wsLost);
        expect(banner.textContent).toContain(idleReload);
        expect(document.getElementById("genos-toast-region")?.textContent ?? "").not.toContain(
            wsLost
        );
    });

    it("announces a failure assertively and a confirmation politely", () => {
        render(wrap(<ToastHost />));
        act(() => {
            toast.error("Could not save");
            toast.success("Saved");
        });
        const failure = screen.getByText("Could not save").closest("[data-toast-tone]")!;
        const saved = screen.getByText("Saved").closest("[data-toast-tone]")!;
        expect(failure.closest("[aria-live]")?.getAttribute("aria-live")).toBe("assertive");
        expect(saved.closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite");
        // The lane announces; a role on the card inside it would nest live regions.
        expect(failure.hasAttribute("role")).toBe(false);
        expect(saved.hasAttribute("role")).toBe(false);
    });

    it("stays announceable while a Joy modal is open (the modal hides body siblings)", async () => {
        render(
            wrap(
                <>
                    <ToastHost />
                    <Modal open>
                        <ModalDialog>dialog</ModalDialog>
                    </Modal>
                </>
            )
        );
        act(() => void toast.error("Could not save"));
        const region = document.getElementById("genos-toast-region")!;
        await waitFor(() => expect(region.getAttribute("aria-hidden")).not.toBe("true"));
        // And its lanes are still the live regions a screen reader watches.
        expect(region.querySelector('[data-toast-lane="alert"]')?.getAttribute("aria-live")).toBe(
            "assertive"
        );
    });

    it("hides itself after its duration and calls onClose with the reason", () => {
        vi.useFakeTimers();
        const onClose = vi.fn();
        render(
            wrap(
                <Toast duration={3000} open onClose={onClose}>
                    bye
                </Toast>
            )
        );
        act(() => void vi.advanceTimersByTime(2999));
        expect(onClose).not.toHaveBeenCalled();
        act(() => void vi.advanceTimersByTime(2));
        expect(onClose).toHaveBeenCalledWith("timeout");
    });

    it("pauses the timer while hovered, and a null duration never hides", () => {
        vi.useFakeTimers();
        const onClose = vi.fn();
        const { rerender } = render(
            wrap(
                <Toast duration={1000} open onClose={onClose}>
                    pause me
                </Toast>
            )
        );
        const card = document.querySelector("[data-toast-tone]")!;
        fireEvent.mouseEnter(card);
        act(() => void vi.advanceTimersByTime(5000));
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.mouseLeave(card);
        act(() => void vi.advanceTimersByTime(1001));
        expect(onClose).toHaveBeenCalledWith("timeout");

        onClose.mockClear();
        rerender(
            wrap(
                <Toast duration={null} open onClose={onClose}>
                    stay
                </Toast>
            )
        );
        act(() => void vi.advanceTimersByTime(60_000));
        expect(onClose).not.toHaveBeenCalled();
    });

    it("has a close button that reports 'dismiss'", () => {
        const onClose = vi.fn();
        render(
            wrap(
                <Toast open onClose={onClose}>
                    x
                </Toast>
            )
        );
        fireEvent.click(screen.getByRole("button", { name: getMessages().common.actions.close }));
        expect(onClose).toHaveBeenCalledWith("dismiss");
    });

    it("undoable: offers a localized Undo that runs once and removes the toast", () => {
        render(wrap(<ToastHost />));
        const onUndo = vi.fn();
        act(() => void toast.undoable("Task deleted", onUndo));
        const undo = screen.getByRole("button", {
            name: getMessages().common.feedback.toast.undo,
        });
        fireEvent.click(undo);
        expect(onUndo).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Task deleted")).toBeNull();
    });

    it("an action gives people longer to decide (8 s) than a plain toast (5 s)", () => {
        vi.useFakeTimers();
        render(wrap(<ToastHost />));
        act(() => {
            toast.undoable("with undo", () => {});
            toast.neutral("plain");
        });
        act(() => void vi.advanceTimersByTime(5001));
        expect(screen.queryByText("plain")).toBeNull();
        expect(screen.getByText("with undo")).toBeTruthy();
        act(() => void vi.advanceTimersByTime(3000));
        expect(screen.queryByText("with undo")).toBeNull();
    });

    it("a re-shown id replaces the card and restarts its timer", () => {
        vi.useFakeTimers();
        render(wrap(<ToastHost />));
        act(() => void toast.show("first", { id: "k", duration: 3000 }));
        act(() => void vi.advanceTimersByTime(2500));
        act(() => void toast.show("second", { id: "k", duration: 3000 }));
        act(() => void vi.advanceTimersByTime(2500));
        // 5 s after the first show, but only 2.5 s after the second.
        expect(screen.getByText("second")).toBeTruthy();
        act(() => void vi.advanceTimersByTime(600));
        expect(screen.queryByText("second")).toBeNull();
    });

    it("under the cap, an Undo toast outlives plain ones", () => {
        render(wrap(<ToastHost />));
        act(() => {
            toast.undoable("deleted", () => {});
            for (let i = 0; i < MAX_VISIBLE + 2; i++) toast.neutral(`n${i}`);
        });
        expect(screen.getByText("deleted")).toBeTruthy();
    });

    it("the same id replaces instead of stacking; the stack is capped", () => {
        render(wrap(<ToastHost />));
        act(() => {
            toast.show("first", { id: "k" });
            toast.show("second", { id: "k" });
        });
        expect(screen.queryByText("first")).toBeNull();
        expect(screen.getByText("second")).toBeTruthy();
        act(() => {
            for (let i = 0; i < MAX_VISIBLE + 3; i++) toast.neutral(`n${i}`);
        });
        expect(document.querySelectorAll("[data-toast-tone]")).toHaveLength(MAX_VISIBLE);
        expect(screen.queryByText("n0")).toBeNull();
        expect(screen.getByText(`n${MAX_VISIBLE + 2}`)).toBeTruthy();
    });

    it("speaks Arabic: the region name and Undo come from the ar catalog", async () => {
        const msgs = await loadLocale("ar");
        localStorage.setItem(LOCALE_STORAGE_KEY, "ar");
        render(
            <I18nProvider>
                <CssVarsProvider>
                    <ToastHost />
                </CssVarsProvider>
            </I18nProvider>
        );
        act(() => void toast.undoable("حُذفت المهمة", () => {}));
        expect(document.getElementById("genos-toast-region")!.getAttribute("aria-label")).toBe(
            msgs.common.feedback.toast.region
        );
        expect(msgs.common.feedback.toast.undo).not.toBe(
            getMessages("en").common.feedback.toast.undo
        );
        expect(screen.getByRole("button", { name: msgs.common.feedback.toast.undo })).toBeTruthy();
        localStorage.removeItem(LOCALE_STORAGE_KEY);
    });
});

describe("TabStrip", () => {
    const tabs: TabItem[] = [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta", count: 3, attention: true },
        { id: "c", label: "Gamma", disabled: true },
        { id: "d", label: "Delta", closable: true },
    ];
    const mount = (value = "a", rtl = false) => {
        const onChange = vi.fn();
        const onClose = vi.fn();
        const utils = render(
            wrap(
                <div style={rtl ? { direction: "rtl" } : undefined}>
                    <TabStrip
                        ariaLabel="Sections"
                        closeLabel="Close tab"
                        tabs={tabs}
                        value={value}
                        onChange={onChange}
                        onClose={onClose}
                    />
                </div>
            )
        );
        return { onChange, onClose, ...utils };
    };

    beforeEach(() => {
        // jsdom has no layout; the strip only calls these for scrolling.
        window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            cb(0);
            return 0;
        }) as typeof window.requestAnimationFrame;
    });

    it("is a named tablist whose selected tab is the only tab stop", () => {
        mount("b");
        expect(screen.getByRole("tablist", { name: "Sections" })).toBeTruthy();
        const tabEls = screen.getAllByRole("tab");
        expect(tabEls).toHaveLength(4);
        expect(screen.getByRole("tab", { name: /Beta/ }).getAttribute("aria-selected")).toBe(
            "true"
        );
        expect(tabEls.filter((t) => t.tabIndex === 0)).toHaveLength(1);
        expect(screen.getByRole("tab", { name: /Beta/ }).tabIndex).toBe(0);
        expect((screen.getByRole("tab", { name: "Gamma" }) as HTMLButtonElement).disabled).toBe(
            true
        );
    });

    it("when the selected tab is gone, the first enabled tab is the tab stop and arrows still work", () => {
        const { onChange } = mount("zzz");
        expect(screen.getByRole("tab", { name: "Alpha" }).tabIndex).toBe(0);
        fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
        expect(onChange).toHaveBeenLastCalledWith("b");
    });

    it("Delete on a tab moves focus to its neighbour", () => {
        const { onClose } = mount("a");
        const delta = screen.getByRole("tab", { name: "Delta" });
        delta.focus();
        fireEvent.keyDown(delta, { key: "Delete" });
        expect(onClose).toHaveBeenCalledWith("d");
        // Delta is last: focus goes to the previous enabled tab, Beta.
        expect(document.activeElement).toBe(screen.getByRole("tab", { name: /Beta/ }));
    });

    it("click selects, a disabled tab does not", () => {
        const { onChange } = mount();
        fireEvent.click(screen.getByRole("tab", { name: /Beta/ }));
        expect(onChange).toHaveBeenCalledWith("b");
        onChange.mockClear();
        fireEvent.click(screen.getByRole("tab", { name: "Gamma" }));
        expect(onChange).not.toHaveBeenCalled();
    });

    it("arrow keys move to the next ENABLED tab and wrap; Home/End jump", () => {
        const { onChange } = mount("b");
        const list = screen.getByRole("tablist");
        fireEvent.keyDown(list, { key: "ArrowRight" });
        expect(onChange).toHaveBeenLastCalledWith("d"); // skips disabled Gamma
        fireEvent.keyDown(list, { key: "ArrowLeft" });
        expect(onChange).toHaveBeenLastCalledWith("a");
        fireEvent.keyDown(list, { key: "End" });
        expect(onChange).toHaveBeenLastCalledWith("d");
        fireEvent.keyDown(list, { key: "Home" });
        expect(onChange).toHaveBeenLastCalledWith("a");
    });

    it("wraps from the last tab to the first", () => {
        const { onChange } = mount("d");
        fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
        expect(onChange).toHaveBeenLastCalledWith("a");
    });

    it("mirrors the arrows in right-to-left", () => {
        const { onChange } = mount("a", true);
        fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
        expect(onChange).toHaveBeenLastCalledWith("d");
    });

    it("shows a count that is accented when it needs attention, and caps at 99+", () => {
        mount();
        expect(screen.getByRole("tab", { name: /Beta/ }).textContent).toContain("3");
        cleanup();
        render(
            wrap(
                <TabStrip
                    ariaLabel="s"
                    tabs={[{ id: "x", label: "X", count: 250 }]}
                    value="x"
                    onChange={() => {}}
                />
            )
        );
        expect(screen.getByRole("tab").textContent).toContain("99+");
    });

    it("turns the mouse wheel into a sideways scroll while the strip overflows", () => {
        mount();
        const list = screen.getByRole("tablist");
        // jsdom has no layout: fake an overflowing strip.
        Object.defineProperty(list, "scrollWidth", { value: 900, configurable: true });
        Object.defineProperty(list, "clientWidth", { value: 300, configurable: true });
        list.scrollLeft = 0;
        const event = new WheelEvent("wheel", { deltaY: 120, cancelable: true });
        list.dispatchEvent(event);
        expect(list.scrollLeft).toBe(120);
        expect(event.defaultPrevented).toBe(true);
        // Not overflowing: leave the page's own scrolling alone.
        Object.defineProperty(list, "scrollWidth", { value: 300, configurable: true });
        const calm = new WheelEvent("wheel", { deltaY: 120, cancelable: true });
        list.dispatchEvent(calm);
        expect(calm.defaultPrevented).toBe(false);
    });

    it("closes a closable tab by button and by Delete, without selecting it", () => {
        const { onClose, onChange } = mount("a");
        fireEvent.click(screen.getByRole("button", { name: "Close tab" }));
        expect(onClose).toHaveBeenCalledWith("d");
        expect(onChange).not.toHaveBeenCalled();
        onClose.mockClear();
        fireEvent.keyDown(screen.getByRole("tab", { name: "Delta" }), { key: "Delete" });
        expect(onClose).toHaveBeenCalledWith("d");
        onClose.mockClear();
        fireEvent.keyDown(screen.getByRole("tab", { name: "Alpha" }), { key: "Delete" });
        expect(onClose).not.toHaveBeenCalled();
    });
});
