import { ExternalChip } from "../../../../components/ui/misc/ExternalChip";
import { fmt, useTranslation } from "../../../../i18n";
import { AllChatProps } from "../../../../types/chat";

type ExternalChatChipProps = {
    /** The open chat's id. `ThreadProps` types it as a number, so both. */
    chatId: string | number | null | undefined;
    /** Legacy ids are per-kind integers, so the kind disambiguates them.
     *  Omit when the caller doesn't know it (a thread names its parent). */
    chatType?: number;
    allChats: AllChatProps[];
    size?: "sm" | "md";
};

/**
 * The "another team is in this room" chip for an open chat pane.
 *
 * Reads the flag off the chat's sidebar row rather than the open-pane
 * object: `ChatProps` / `ThreadProps` are assembled per pane by
 * `defineNewChat` and carry no sharing fields, while the list row that
 * opened the pane always does — the same row the sidebar badges from, so
 * the header and the sidebar can never disagree.
 *
 * Renders nothing for an ordinary chat, which is nearly all of them.
 */
export const ExternalChatChip = ({
    chatId,
    chatType,
    allChats,
    size = "sm",
}: ExternalChatChipProps) => {
    const { t } = useTranslation();
    if (chatId == null || chatId === "") return null;
    const row = allChats.find(
        (c) => String(c.chatId) === String(chatId) && (chatType == null || c.chatType === chatType)
    );
    if (!row?.isExternal) return null;
    return (
        <ExternalChip
            hint={
                row.hostTeamName
                    ? fmt(t.chat.sidebar.sharedByTeamHint, { team: row.hostTeamName })
                    : t.chat.sidebar.externalBadgeHint
            }
            label={row.hostTeamName || t.chat.sidebar.externalBadge}
            size={size}
        />
    );
};
