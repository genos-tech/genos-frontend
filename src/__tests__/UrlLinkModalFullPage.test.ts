/**
 * The preview's "Move to page" button. Since a plain click on a Spotlight
 * result now opens the quick-look preview rather than navigating, the
 * preview needs its own way out to the real page — the discoverable twin
 * of Cmd/Ctrl-clicking the row.
 *
 * The action is supplied per-open by whoever opened the preview (only
 * they know how to land on the page: `ModalTarget` drops the href, and a
 * chat needs `moveToSpecificChat` rather than a bare navigate). These
 * tests pin the three things that behaviour turns on: the button appears
 * only when an action was supplied, invoking it closes the preview first
 * (a navigation behind an open dialog reads as "nothing happened"), and
 * it does NOT survive the preview re-targeting itself.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useUrlLinkModalState } from "../hooks/common/useUrlLinkModalState";

const TASK_HREF = "/workspace/tasks/project/7/task/42";
const NOTE_HREF = "/workspace/notes/my/9";

describe("UrlLinkModal → Move to page", () => {
    it("exposes no action for a preview opened without one", () => {
        const navigate = vi.fn();
        const { result } = renderHook(() => useUrlLinkModalState({ navigate }));

        act(() => {
            result.current.openModalByHref(TASK_HREF);
        });

        expect(result.current.target?.kind).toBe("task");
        // Chat-message links open the preview this way: the user is
        // already reading the surface the link came from, so the modal
        // shows only its ✕.
        expect(result.current.openFullPage).toBeNull();
    });

    it("closes the preview and runs the caller's navigation", () => {
        const navigate = vi.fn();
        const onOpenFullPage = vi.fn();
        const { result } = renderHook(() => useUrlLinkModalState({ navigate }));

        act(() => {
            result.current.openModalByHref(TASK_HREF, { onOpenFullPage, zIndex: 13200 });
        });
        expect(result.current.openFullPage).not.toBeNull();

        act(() => {
            result.current.openFullPage?.();
        });

        expect(onOpenFullPage).toHaveBeenCalledTimes(1);
        // Closed, so the page the caller navigates to is actually
        // visible — and the action is gone with the preview.
        expect(result.current.target).toBeNull();
        expect(result.current.zIndex).toBeUndefined();
        expect(result.current.openFullPage).toBeNull();
    });

    it("drops the action when a link inside the preview re-targets it", () => {
        const navigate = vi.fn();
        const onOpenFullPage = vi.fn();
        const { result } = renderHook(() => useUrlLinkModalState({ navigate }));

        act(() => {
            result.current.openModalByHref(TASK_HREF, { onOpenFullPage, zIndex: 13200 });
        });
        act(() => {
            result.current.openModalByHref(NOTE_HREF);
        });

        expect(result.current.target?.kind).toBe("myNote");
        // The note now on screen isn't what the action would open, so it
        // must not linger — unlike the stacking level, which IS kept so
        // the preview doesn't drop behind the surface that opened it.
        expect(result.current.openFullPage).toBeNull();
        expect(result.current.zIndex).toBe(13200);
        expect(onOpenFullPage).not.toHaveBeenCalled();
    });
});
