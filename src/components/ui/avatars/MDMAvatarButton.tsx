import { useEffect, useState } from "react";

import { ModalMDMMembers } from "../../../features/chat/components/modals/ModalMDMMembers";
import { fmt, useTranslation } from "../../../i18n";
import { AllChatProps } from "../../../types/chat";
import { withoutDeletedUsers } from "../../../utils/teamRoster";
import { Clickable } from "../Clickable";
import { useOptionalAvatarContext } from "./AvatarContext";
import { MDMAvatar } from "./MDMAvatar";

type Props = {
    /** The multi-person DM's row from the chat list. Without it there is nothing to manage. */
    chat: AllChatProps | undefined;
    size?: "sm" | "md";
    avatarSize?: number;
    /** The chat list's presence dots and paused moons. */
    showPresence?: boolean;
    /** The layer of the modal this chip is drawn in, when it is in one. */
    hostZIndex?: number;
};

/**
 * The multi-person DM's stack of faces as a button that opens its members (MIP-2549), the way
 * `GMAvatar` opens the group profile. A press stays on the chip: it does not also open the row
 * the chip sits in. Without the chat (left, or not loaded), or outside the signed-in shell, it
 * draws the plain stack. What the modal needs comes from the avatar context, so a surface only
 * hands over the chat.
 */
export const MDMAvatarButton = ({ chat, size, avatarSize, showPresence, hostZIndex }: Props) => {
    const { t } = useTranslation();
    const ctx = useOptionalAvatarContext();
    const [open, setOpen] = useState(false);
    // A chat that goes (left, removed) takes its modal with it: added back, it stays shut.
    useEffect(() => {
        if (!chat) setOpen(false);
    }, [chat]);

    const stack = (
        <MDMAvatar
            avatarSize={avatarSize}
            members={chat?.mdmMembers}
            size={size}
            teamMemberProfiles={showPresence ? ctx?.teamMemberProfiles : undefined}
        />
    );
    if (!chat || !ctx) return stack;

    return (
        <>
            <Clickable
                data-testid="mdm-chip"
                label={fmt(t.chat.modals.mdmMembers.chipLabel, {
                    count: withoutDeletedUsers([...(chat.mdmMembers ?? [])]).length,
                })}
                sx={{
                    display: "flex",
                    flexShrink: 0,
                    alignSelf: "center",
                    borderRadius: "999px !important",
                    // Rows paint their own hover; the chip says it is a control too.
                    "&:hover": { filter: "brightness(1.08)" },
                }}
                // `stopPropagation`: the row behind the chip (a chat list row, an activity
                // card) must not open as well.
                onActivate={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                }}
            >
                {stack}
            </Clickable>
            {/* Mounted only while open: there is a chip on every row of the chat list. */}
            {open && (
                <ModalMDMMembers
                    chat={chat}
                    hostZIndex={hostZIndex}
                    myself={ctx.myself}
                    setMyself={ctx.setMyself}
                    socket={ctx.socket}
                    teamMemberProfiles={ctx.teamMemberProfiles}
                    useCM={ctx.useCM}
                    useUISM={ctx.useUISM}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
};
