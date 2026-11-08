import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAppNavigateRequests } from "../hooks/common/useAppNavigateRequests";
import { APP_NAVIGATE_EVENT, requestAppNavigate } from "../services/appNavigate";

describe("requestAppNavigate", () => {
    it("navigates in place to an in-app path", () => {
        const navigate = vi.fn();
        renderHook(() => useAppNavigateRequests(navigate));
        requestAppNavigate("/workspace/inbox");
        expect(navigate).toHaveBeenCalledWith("/workspace/inbox");
    });

    it("uses the latest navigate without re-subscribing", () => {
        const first = vi.fn();
        const second = vi.fn();
        const view = renderHook(({ nav }) => useAppNavigateRequests(nav), {
            initialProps: { nav: first },
        });
        view.rerender({ nav: second });
        requestAppNavigate("/workspace/plans");
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledWith("/workspace/plans");
    });

    it("refuses anything that is not an in-app path", () => {
        const navigate = vi.fn();
        renderHook(() => useAppNavigateRequests(navigate));
        requestAppNavigate("https://evil.example/x");
        requestAppNavigate("workspace/inbox");
        window.dispatchEvent(
            new CustomEvent(APP_NAVIGATE_EVENT, { detail: "https://evil.example" })
        );
        window.dispatchEvent(new CustomEvent(APP_NAVIGATE_EVENT, { detail: { path: "/x" } }));
        expect(navigate).not.toHaveBeenCalled();
    });

    it("stops listening on unmount", () => {
        const navigate = vi.fn();
        renderHook(() => useAppNavigateRequests(navigate)).unmount();
        requestAppNavigate("/workspace/inbox");
        expect(navigate).not.toHaveBeenCalled();
    });
});
