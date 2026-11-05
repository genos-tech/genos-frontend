/**
 * UrlLinkModal on a phone: a task / milestone preview takes the whole screen.
 *
 * As a centred card (88vh x 92vw, 20px corners) it left a strip of backdrop
 * above and below and 20px at each side. On a phone the preview now uses Joy's
 * `fullscreen` layout (pinned to every edge of the modal root); every other
 * view, and every desktop preview, keeps the card.
 *
 * `useIsMobile` is mocked the way `ToDoPaneLayout.test.tsx` does it. The layout
 * is read from Joy's ownerState class on the dialog (`MuiModalDialog-layout*`),
 * which does not depend on media queries.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UrlLinkModal } from "../components/modals/UrlLinkModal";
import type { ModalTarget } from "../utils/parseInternalUrl";

let isMobileViewport = false;
vi.mock("../hooks/common/useIsMobile", () => ({
    useIsMobile: () => isMobileViewport,
}));

vi.mock("../components/modals/views/ModalChatView", () => ({ ModalChatView: () => null }));
vi.mock("../components/modals/views/ModalMilestoneView", () => ({
    ModalMilestoneView: () => null,
}));
vi.mock("../components/modals/views/ModalNoteView", () => ({ ModalNoteView: () => null }));
vi.mock("../components/modals/views/ModalTaskView", () => ({ ModalTaskView: () => null }));
vi.mock("../components/modals/views/ModalTodoView", () => ({ ModalTodoView: () => null }));

const baseProps = {
    onClose: vi.fn(),
    accessToken: "token",
    myself: { teamId: "team-1", userId: "u1" },
    setMyself: vi.fn(),
    socket: null,
    useTEM: {},
    useUISM: {},
    useCM: {},
    useTM: {},
    usePM: {},
    useNM: {},
    useSM: {},
    useTG: {},
} as unknown as React.ComponentProps<typeof UrlLinkModal>;

const TASK: ModalTarget = { kind: "task", projectId: 1, taskId: 2 };
const MILESTONE: ModalTarget = { kind: "milestone", projectId: 1, milestoneId: 2 };
const CHAT: ModalTarget = { kind: "chatMain", chatType: 1, chatId: 1 };
const TODO: ModalTarget = { kind: "todo", localDate: "2026-07-13" };
const NOTE: ModalTarget = { kind: "myNote", noteId: 1 };

const dialogFor = (target: ModalTarget): HTMLElement => {
    render(
        <CssVarsProvider>
            <UrlLinkModal {...baseProps} target={target} />
        </CssVarsProvider>
    );
    // Joy portals the modal to <body>.
    const dialog = document.body.querySelector<HTMLElement>(".MuiModalDialog-root");
    if (!dialog) throw new Error("no dialog rendered");
    return dialog;
};

// jsdom can't hold what these assertions are about: `getComputedStyle` drops
// values it can't parse (a `min(...)` height comes back as "auto", a `max(env())`
// padding as "0") and its CSSOM drops them from the rules too. So the declarations
// are read from the raw text emotion wrote into its <style> tags, for the
// dialog's own class.
const declaredCss = (el: HTMLElement): string => {
    const raw = Array.from(document.querySelectorAll("style"))
        .map((tag) => tag.textContent ?? "")
        .join("\n");
    const cls = Array.from(el.classList).find((c) => c.startsWith("css-")) ?? "";
    const block = raw.match(new RegExp(`\\.${cls}\\{([^}]*)\\}`));
    if (!block) throw new Error(`no emotion rule found for .${cls}`);
    return block[1];
};

describe("UrlLinkModal on mobile", () => {
    beforeEach(() => {
        isMobileViewport = false;
        document.body.innerHTML = "";
    });

    it.each([
        ["task", TASK],
        ["milestone", MILESTONE],
    ])("shows a %s preview full screen on a phone", (_name, target) => {
        isMobileViewport = true;
        const dialog = dialogFor(target);

        expect(dialog.classList.contains("MuiModalDialog-layoutFullscreen")).toBe(true);
        // No card chrome, no fixed size: Joy's fullscreen layout pins all four
        // edges, so nothing here may re-impose a height or width.
        const css = declaredCss(dialog);
        expect(css).not.toContain("min(900px, 88vh)");
        expect(css).not.toContain("min(1200px, 92vw)");
        expect(css).not.toContain("border-radius:20px");
        // Joy modals paint over the tab bar and the keyboard, so the content
        // stays off the home indicator, and off the keyboard when it is up.
        expect(css).toContain(
            "padding-bottom:max(env(safe-area-inset-bottom, 0px), var(--keyboard-inset, 0px))"
        );
    });

    it.each([
        ["task", TASK],
        ["milestone", MILESTONE],
    ])("keeps the %s preview a card on desktop", (_name, target) => {
        isMobileViewport = false;
        const dialog = dialogFor(target);

        expect(dialog.classList.contains("MuiModalDialog-layoutCenter")).toBe(true);
        const css = declaredCss(dialog);
        expect(css).toContain("height:min(900px, 88vh)");
        expect(css).toContain("width:min(1200px, 92vw)");
        expect(css).toContain("border-radius:20px");
        expect(css).not.toContain("padding-bottom:max(");
    });

    it.each([
        ["chat", CHAT],
        ["to-do", TODO],
        ["note", NOTE],
    ])("keeps the %s view a card on a phone", (_name, target) => {
        isMobileViewport = true;
        const dialog = dialogFor(target);

        expect(dialog.classList.contains("MuiModalDialog-layoutCenter")).toBe(true);
        const css = declaredCss(dialog);
        expect(css).toContain("height:min(900px, 88vh)");
        expect(css).toContain("border-radius:20px");
    });
});
