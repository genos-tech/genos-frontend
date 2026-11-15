// The "Ask Genos" entry of a chat message's "…" menu (MIP-1058, genos-api AGENT_PARITY_TOOLS): ONE
// definition for the main-message menu and the thread-reply menu, so every chat type (DM, GM, PM, MDM)
// and every view behaves the same.
//
//   - It points Ask at the message by its v3 id (`messageIdWithChatId` of a main message,
//     `messageIdWithChatIdAndThreadId` of a reply); a message without one (an optimistic row, an old
//     cached row) gets no item rather than one that silently does nothing.
//   - When text is selected inside THIS message at the moment the menu opens, the item says so ("about
//     the selected text") and asks about that passage instead, with the message as its source. This is
//     the keyboard and screen-reader way to the selection: the floating "Ask Genos" button next to a
//     selection (`ChatSelectionAsk`) is a pointer feature.
//   - The mention label is built when the item is CLICKED, not on each render: it takes a name that
//     no other message in the draft has (`askGenosRefForMessage`), so rendering a list must not hand
//     them out.

import { useCallback, useState } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";

import type { MoreMenuItem } from "../../../components/ui/MoreMenu";
import { useTranslation } from "../../../i18n";
import { makeAskSelection } from "../../agentQA/askSelection";
import {
    askGenosRefForMessage,
    askGenosSourceForMessage,
    isMessageUuid,
    requestAskGenosAbout,
    requestAskGenosAboutSelection,
} from "../../spotlight/askGenosAbout";
import { readMessageSelection } from "../utils/messageSelection";

export const useAskGenosMessageItem = ({
    messageId,
    senderName,
    tsSent,
}: {
    /** The v3 `Message.id`: NOT the sequence `messageId`. */
    messageId: string | null | undefined;
    senderName?: string | null;
    tsSent?: string | null;
}): {
    // `kind` and `visible` are always set, so a menu that types its items strictly takes it as is.
    item: MoreMenuItem & { kind: "askGenos"; visible: boolean };
    /** Call with the menu's open state: it reads the selection when the menu opens. */
    onMenuOpenChange: (open: boolean) => void;
} => {
    const { t, locale } = useTranslation();
    // What was selected inside this message when the menu opened ("" = nothing).
    const [selectedText, setSelectedText] = useState("");

    const onMenuOpenChange = useCallback(
        (open: boolean) =>
            setSelectedText(open ? (readMessageSelection(messageId)?.text ?? "") : ""),
        [messageId]
    );

    const hasSelection = selectedText.trim() !== "";
    const item: MoreMenuItem & { kind: "askGenos"; visible: boolean } = {
        icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />,
        id: "askGenos",
        kind: "askGenos",
        label: hasSelection
            ? t.chat.messageActions.askGenosSelection
            : t.chat.messageActions.askGenos,
        onClick: () => {
            if (hasSelection) {
                const selection = makeAskSelection(
                    selectedText,
                    askGenosSourceForMessage(messageId)
                );
                if (selection) {
                    requestAskGenosAboutSelection(selection);
                    return;
                }
            }
            const ref = askGenosRefForMessage({
                id: messageId,
                senderName,
                tsSent,
                locale,
                fallbackLabel: t.chat.messageActions.askGenosFallback,
            });
            if (ref) requestAskGenosAbout(ref);
        },
        visible: isMessageUuid(messageId),
    };
    return { item, onMenuOpenChange };
};
