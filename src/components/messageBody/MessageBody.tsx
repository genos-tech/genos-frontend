/**
 * Drop-in replacement for `BnChatPreview` in read-only message bubbles.
 *
 * Routes each message to the cheapest renderer that can display it
 * faithfully:
 *
 *   - `LightMessageBody` — plain DOM, no editor. Handles paragraphs,
 *     headings, lists, text styling, links and mention/emoji chips,
 *     which on real data is the overwhelming majority of messages.
 *   - `BnChatPreview` — the original BlockNote editor. Handles
 *     everything else (media, code blocks, tables, `#` mentions) and
 *     stays the safety net for anything the light path doesn't
 *     recognise.
 *
 * Same props as `BnChatPreview` so bubbles can swap one for the other,
 * and both paths sit inside the identical `.bn-message-bubble-box-*`
 * wrapper — the App.css rules keyed on it (colours per sent/received
 * and per theme, the `bn-unwrap-*` toggles, the `data-changing-font-demo`
 * font override) apply to both without duplication.
 *
 * Works unchanged in BOTH bubble formats: "Bubble" and "Compact" differ
 * in the surrounding chrome (avatar placement, background, toolbar
 * position) which the bubble components own — the body markup is the
 * same in each, which is why this component takes no format prop.
 */

import { PartialBlock } from "@blocknote/core";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { BnChatPreview } from "../editors/bnChatPreview";
import { canRenderLight } from "./lightBodySupport";
import { LightMessageBody } from "./LightMessageBody";

export type MessageBodyProps = {
    content: PartialBlock[] | any[];
    isSent: boolean;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    customClassName?: string;
    /** Escape hatch: force the BlockNote path regardless of content.
     *  Exists so a surface that needs editor-only behaviour can opt out
     *  without the caller having to know why. */
    forceFullEditor?: boolean;
};

export const MessageBody = (props: MessageBodyProps) => {
    const {
        content,
        isSent,
        myself,
        setMyself,
        socket,
        useCM,
        useTEM,
        useUISM,
        customClassName,
        forceFullEditor = false,
    } = props;

    const { mode } = useColorScheme();

    if (forceFullEditor || !canRenderLight(content)) {
        return (
            <BnChatPreview
                content={content}
                customClassName={customClassName}
                isSent={isSent}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
            />
        );
    }

    // Mirrors `BnChatPreview`'s own wrapper so the two paths are
    // interchangeable: same box class (which App.css keys colours off),
    // same `--bn-preview-box-px` padding, same `bn-root` classes and
    // `data-changing-font-demo` attribute that drive the BlockNote
    // stylesheet and the Inter font override.
    const boxClassName = customClassName
        ? `${customClassName}-${mode}`
        : isSent
          ? `bn-message-bubble-box-${mode}-me`
          : `bn-message-bubble-box-${mode}`;

    return (
        <Box className={boxClassName} sx={{ px: "var(--bn-preview-box-px)" }}>
            <div
                className={`bn-root bn-container ${mode === "dark" ? "dark" : "light"} bn-mantine bn-box`}
                data-color-scheme={mode === "dark" ? "dark" : "light"}
                data-changing-font-demo
            >
                <LightMessageBody
                    content={content}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            </div>
        </Box>
    );
};
