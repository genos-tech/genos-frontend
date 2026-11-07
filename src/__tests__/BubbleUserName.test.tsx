/**
 * The author line of a chat message (MIP-1130): one author style and one meta
 * style, "Edited" in the user's language, and a task card's status through the
 * shared StatusLabel rather than a chip of its own.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BubbleUserName } from "../features/chat/components/bubbles/BubbleUserName";
import { UserProps } from "../types/admin";

const sender = { userId: "u2", userName: "Ann", isSystemUser: false } as UserProps;

const mount = (over: Partial<React.ComponentProps<typeof BubbleUserName>> = {}) =>
    render(
        <CssVarsProvider>
            <BubbleUserName
                chatType={1}
                dtSent="Jul 20, 09:12"
                isSent={false}
                isSimpleBubble={false}
                isThread={false}
                sender={sender}
                taskId={null}
                taskStatus={null}
                tsSent="2026-07-20T09:12:00Z"
                tsUpdated="2026-07-20T09:12:00Z"
                {...over}
            />
        </CssVarsProvider>
    );

describe("BubbleUserName", () => {
    it("shows the author and the time", () => {
        mount();
        expect(screen.getByText("Ann")).toBeInTheDocument();
        expect(screen.getByText("Jul 20, 09:12")).toBeInTheDocument();
    });

    it("says Edited (localized) after the time when it was edited", () => {
        mount({ tsUpdated: "2026-07-20T09:30:00Z" });
        expect(screen.getByText("Jul 20, 09:12 Edited")).toBeInTheDocument();
    });

    it("omits the name for a grouped follow-up but keeps the time", () => {
        mount({ isSimpleBubble: true });
        expect(screen.queryByText("Ann")).toBeNull();
        expect(screen.getByText("Jul 20, 09:12")).toBeInTheDocument();
    });

    it("renders a PM task card header with the id chip and the shared status label", () => {
        mount({
            chatType: 3,
            displayId: "TP-139",
            taskId: 139,
            taskStatus: "Open",
        });
        expect(screen.getByText("TP-139")).toBeInTheDocument();
        expect(screen.getByText("Open")).toBeInTheDocument();
        // The status is a StatusLabel (plain spans), not a filled chip.
        expect(screen.queryByText("Ann")).toBeNull();
    });
});
