/**
 * MIP-2520: opening a thread read digits off the end of `moveToSpecificIndex` (a message UUID)
 * and wrote them into the URL as `/message/<number>`.
 */

import { renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useChatRouting } from "../features/chat/hooks/useChatRouting";

const CHAT = "11111111-1111-4111-8111-111111111111";
const THREAD = "22222222-2222-4222-8222-222222222222";
// A UUID whose last group is all digits.
const MESSAGE = "33333333-3333-4333-8333-000000000123";

describe("the URL of an opened thread", () => {
    it("carries no message segment made from the focused message's UUID", () => {
        const useCM = {
            allChats: [],
            currentMainChat: { chatId: CHAT, chatType: 1 },
            currentThreadChat: {
                chatId: CHAT,
                chatType: 1,
                threadId: THREAD,
                moveToSpecificIndex: MESSAGE,
            },
            isThreadVisible: true,
            setCurrentMainChat: vi.fn(),
            setCurrentThreadChat: vi.fn(),
            setIsThreadVisible: vi.fn(),
            setNotMoveChatPaneType: vi.fn(),
        };
        const { result } = renderHook(
            () => {
                useChatRouting({
                    useCM: useCM as never,
                    useTM: {} as never,
                    myself: { userId: "u1", teamId: "t1" } as never,
                    isActiveRoute: true,
                });
                return useLocation().pathname;
            },
            {
                wrapper: ({ children }) => (
                    <MemoryRouter initialEntries={[`/workspace/chat/dm/${CHAT}`]}>
                        {children}
                    </MemoryRouter>
                ),
            }
        );
        expect(result.current).toBe(`/workspace/chat/dm/${CHAT}/thread/${THREAD}`);
    });
});
