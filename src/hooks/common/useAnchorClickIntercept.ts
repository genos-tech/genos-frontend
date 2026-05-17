import { RefObject, useLayoutEffect } from "react";

// Intercept left-clicks on `<a>` elements inside `rootRef` and route
// them through the URL-link modal. Returns nothing — the side-effect is
// the listener attached to `rootRef.current`.
//
// Why a native event listener + capture phase (and not just React's
// `onClickCapture`)?
//
// BlockNote (via TipTap / ProseMirror) registers a `handleClick` plugin
// that calls `window.open(href, "_blank")` for `<a>` links in edit mode
// — see `node_modules/@blocknote/core/dist/src-*.js` near the
// "handleClickLink" key. The plugin's DOM listener lives on the
// editor's contentDOM (a descendant of our wrapper).
//
// React 17+ delegates events at the React root, then dispatches its
// synthetic capture handlers. In theory, calling `stopPropagation()`
// from a synthetic `onClickCapture` should also stop the underlying
// native event from continuing down to ProseMirror's listener — but in
// practice this seam doesn't reliably stop ProseMirror's plugin
// (probably because ProseMirror's listener was attached at a phase
// React's delegation doesn't precede on every browser). The visible
// symptom was: the modal opened **and** a new browser tab opened, and
// the new tab stole focus.
//
// Attaching the listener directly to the wrapper element with
// `{ capture: true }` puts us in the actual DOM capture phase, before
// any descendant listener runs — ProseMirror's contentDOM is below the
// wrapper, so capture-phase processing on the wrapper fires first. We
// then call all three of `preventDefault` / `stopPropagation` /
// `stopImmediatePropagation` so neither the browser default nor
// ProseMirror's plugin gets a chance to run.
//
// Modifier-click (Cmd/Ctrl/Shift) and non-left-button clicks fall
// through to the browser default — preserves "open in new tab".
export const useAnchorClickIntercept = (
    rootRef: RefObject<HTMLElement | null>,
    urlLinkModal: { openModalByHref: (href: string) => unknown } | null
) => {
    useLayoutEffect(() => {
        const el = rootRef.current;
        if (!el || !urlLinkModal) return;
        const handler = (e: MouseEvent) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            const target = e.target as HTMLElement | null;
            if (!target) return;
            const anchor = target.closest("a") as HTMLAnchorElement | null;
            if (!anchor?.href) return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            urlLinkModal.openModalByHref(anchor.href);
        };
        el.addEventListener("click", handler, { capture: true });
        return () => {
            el.removeEventListener("click", handler, { capture: true });
        };
    }, [rootRef, urlLinkModal]);
};
