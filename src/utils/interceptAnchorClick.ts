import { MouseEvent } from "react";

// Shared anchor-click interceptor used by every BlockNote-based editor /
// viewer in the app. Returns true when the click was intercepted (the
// caller should not run its own click handling afterwards) and false
// otherwise.
//
// Behaviour:
//   - Modifier keys (Cmd / Ctrl / Shift) or non-left-button clicks fall
//     through to the browser's default — preserves "open in new tab".
//   - Plain left-clicks on `<a>` elements (including nested children)
//     call `openModalByHref(href)` and stop the event aggressively:
//       * `preventDefault()` — skip the browser's default link action.
//       * `stopPropagation()` — keep the event from reaching ancestor
//         React handlers (e.g. the bubble's outer onClick).
//       * `nativeEvent.stopImmediatePropagation()` — keep other native
//         listeners on the same element from firing. **This last one
//         matters specifically for editable BlockNote editors:** the
//         editor attaches its own native click handler that calls
//         `window.open(href, "_blank")` for links in edit mode, which
//         runs independently of the browser's default `<a>` action.
//         Without `stopImmediatePropagation()`, clicking a link inside
//         an editable note / task body opens the modal AND a new
//         browser tab. The caller should also use `onClickCapture`
//         (not `onClick`) so this interceptor wins the phase race
//         against BlockNote's own listener on a deeper element.
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
    if (typeof e.nativeEvent?.stopImmediatePropagation === "function") {
        e.nativeEvent.stopImmediatePropagation();
    }
    urlLinkModal.openModalByHref(anchor.href);
    return true;
};
