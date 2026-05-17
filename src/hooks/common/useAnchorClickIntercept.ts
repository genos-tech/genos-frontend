import { RefObject, useLayoutEffect } from "react";

// Intercept left-clicks on `<a>` elements inside `rootRef` and route
// them through the URL-link modal. The side-effect is two native
// capture-phase listeners (`mousedown` + `click`) attached to
// `rootRef.current`.
//
// Why both `mousedown` AND `click`, and why capture phase, and why
// native (not React's onClickCapture)?
//
// BlockNote ships a TipTap/ProseMirror plugin that opens links via an
// **explicit `window.open(href, target)` call** — not via the browser's
// default `<a>` action. (See
// `@blocknote/core/dist/src-*.js` near the "handleClickLink" key.)
// What's surprising is *when* this fires: ProseMirror's `MouseDown`
// class (in `prosemirror-view/dist/index.js` around line 3330)
// registers a `mouseup` listener on `view.root` (the document) inside
// its `mousedown` handler, and dispatches `handleClick` from
// `MouseDown.up()` — i.e. on `mouseup`, **before** the native `click`
// event fires.
//
// That means a `click`-phase interceptor is always too late: by the
// time `click` arrives, `window.open()` has already run and a new
// browser tab has stolen focus.
//
// Fix: intercept `mousedown` in the actual DOM capture phase. Stopping
// the event before ProseMirror's `mousedown` listener (which lives on
// `view.dom`, a descendant of our wrapper) prevents the `MouseDown`
// instance from being created at all — no mouseup listener, no
// `window.open()`. The `click` capture listener then opens the modal
// in the user-expected gesture.
//
// React's `onClickCapture` (synthetic event delegation at the React
// root) was tried first and didn't reliably stop ProseMirror — there's
// a seam between React 17+'s event delegation and ProseMirror's
// `EditorView` subscription where `stopPropagation()` didn't propagate.
// A direct native listener via `useLayoutEffect` sidesteps that
// entirely.
//
// Modifier-click (Cmd / Ctrl / Shift) and non-left-button clicks fall
// through to the browser default — preserves "open in new tab".
export const useAnchorClickIntercept = (
    rootRef: RefObject<HTMLElement | null>,
    urlLinkModal: { openModalByHref: (href: string) => unknown } | null
) => {
    useLayoutEffect(() => {
        const el = rootRef.current;
        if (!el || !urlLinkModal) return;

        const findInterceptableAnchor = (e: MouseEvent): HTMLAnchorElement | null => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return null;
            const target = e.target as HTMLElement | null;
            if (!target) return null;
            const anchor = target.closest("a") as HTMLAnchorElement | null;
            return anchor?.href ? anchor : null;
        };

        // Mousedown is where the real work happens: stop the event
        // before ProseMirror's `mousedown` handler runs and registers
        // its `mouseup → handleClick → window.open` chain.
        const onMouseDown = (e: MouseEvent) => {
            if (!findInterceptableAnchor(e)) return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };

        // Click is where we actually open the modal — it's the gesture
        // users associate with "following a link", even though
        // mousedown is doing the heavy lifting above.
        const onClick = (e: MouseEvent) => {
            const anchor = findInterceptableAnchor(e);
            if (!anchor) return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            urlLinkModal.openModalByHref(anchor.href);
        };

        el.addEventListener("mousedown", onMouseDown, { capture: true });
        el.addEventListener("click", onClick, { capture: true });
        return () => {
            el.removeEventListener("mousedown", onMouseDown, { capture: true });
            el.removeEventListener("click", onClick, { capture: true });
        };
    }, [rootRef, urlLinkModal]);
};
