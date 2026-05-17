import { MouseEvent } from "react";

// Shared anchor-click interceptor used by every BlockNote-based editor /
// viewer in the app. Returns true when the click was intercepted (the
// caller should not run its own click handling afterwards) and false
// otherwise.
//
// Behaviour mirrors the original BnChatPreview implementation:
//   - Modifier keys (Cmd / Ctrl / Shift) or non-left-button clicks fall
//     through to the browser's default — preserves "open in new tab".
//   - Plain left-clicks on `<a>` elements (including nested children)
//     call `openModalByHref(href)`, then preventDefault + stopPropagation
//     so neither the parent bubble's onClick nor BlockNote's own
//     link-cursor logic fires.
//
// Pass `urlLinkModal === null` when used outside the modal provider
// (signin / signup) — the helper no-ops and the browser default runs.
export const interceptAnchorClick = (
    e: MouseEvent<HTMLElement>,
    urlLinkModal: { openModalByHref: (href: string) => unknown } | null
): boolean => {
    if (!urlLinkModal) return false;
    const target = e.target as HTMLElement | null;
    if (!target) return false;
    const anchor = target.closest("a") as HTMLAnchorElement | null;
    if (!anchor?.href) return false;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return false;
    e.preventDefault();
    e.stopPropagation();
    urlLinkModal.openModalByHref(anchor.href);
    return true;
};
