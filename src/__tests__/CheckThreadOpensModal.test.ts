/**
 * "Check thread" must open the thread as a MODAL, not navigate the page
 * (Req 4). Both entry points (TaskTitleBlock button + milestone preview
 * button) build `/workspace/chat/{type}/{chatId}/thread/{threadId}` and
 * hand it to `openModalByHref`. This pins the crux the requirement turns
 * on: that href shape classifies as an in-app modal target ("opened"),
 * not a route hand-off ("navigated") — for both v3 UUID ids (current)
 * and legacy numeric ids (older tasks).
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useUrlLinkModalState } from "../hooks/common/useUrlLinkModalState";
import { parseInternalUrl } from "../utils/parseInternalUrl";

const CHAT_TYPE_TO_PATH: Record<number, string> = { 1: "dm", 2: "gm", 3: "pm", 4: "mdm" };
const buildHref = (chatType: number, chatId: string, threadId: string) =>
    `/workspace/chat/${CHAT_TYPE_TO_PATH[chatType]}/${chatId}/thread/${threadId}`;

describe("Check thread → UrlLinkModal", () => {
    const UUID_A = "847c8111-0000-4000-8000-000000000001";
    const UUID_B = "c0f39cee-0000-4000-8000-000000000002";

    it("classifies the check-thread href as a chatThread modal target (v3 UUIDs)", () => {
        const href = buildHref(1, UUID_A, UUID_B);
        const classified = parseInternalUrl(href);
        expect(classified.kind).toBe("chatThread");
        if (classified.kind === "chatThread") {
            expect(String(classified.chatId)).toBe(UUID_A);
            expect(String(classified.threadId)).toBe(UUID_B);
            expect(classified.chatType).toBe(1);
        }
    });

    it("opens the modal (does NOT navigate) for the check-thread href", () => {
        const navigate = vi.fn();
        const { result } = renderHook(() => useUrlLinkModalState({ navigate }));

        let outcome: string | undefined;
        act(() => {
            outcome = result.current.openModalByHref(buildHref(4, UUID_A, UUID_B));
        });

        expect(outcome).toBe("opened");
        expect(navigate).not.toHaveBeenCalled();
        expect(result.current.target?.kind).toBe("chatThread");
    });

    it("still opens as a modal for legacy numeric ids", () => {
        const navigate = vi.fn();
        const { result } = renderHook(() => useUrlLinkModalState({ navigate }));

        let outcome: string | undefined;
        act(() => {
            outcome = result.current.openModalByHref(buildHref(2, "10", "126"));
        });

        expect(outcome).toBe("opened");
        expect(navigate).not.toHaveBeenCalled();
        expect(result.current.target?.kind).toBe("chatThread");
    });
});
