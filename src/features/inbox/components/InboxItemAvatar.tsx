import { useEffect, type ElementType, type ReactNode } from "react";
import { Box } from "@mui/joy";

import { useOptionalAvatarContext } from "../../../components/ui/avatars/AvatarContext";
import { BaseAvatar } from "../../../components/ui/avatars/BaseAvatar";
import { GenosAuthorAvatar } from "../../../components/ui/avatars/GenosAuthor";
import { UserAvatar } from "../../../components/ui/avatars/UserAvatar";
import { rememberPeople } from "../../../components/ui/avatars/userDirectory";
import type { InboxActor } from "./inboxActor";
import type { InboxTone } from "./inboxItemConfig";

type Props = {
    /** The person the card is about, when its body names one. */
    actor: InboxActor | null;
    /** Genos wrote the card: the Genos mark is its face. */
    byGenos: boolean;
    tone: InboxTone;
    /** The type's icon, for a card with no person and not from Genos. */
    Icon: ElementType;
};

/**
 * The card's face, in the avatar column of the shared `Bubble` row.
 *
 * Always one 32px mark, so a card never leaves an empty column: the real avatar of the person
 * (it opens their profile), the Genos mark for what Genos wrote, else a soft tile carrying the
 * type's icon. Outside the app shell there is no avatar context to look a person up in, so the
 * person's initial stands in rather than throwing.
 */
export const InboxItemAvatar = ({ actor, byGenos, tone, Icon }: Props) => {
    const ctx = useOptionalAvatarContext();
    // The API sends the sender's name and avatar path with the card. Hand them to the avatar
    // directory so a person outside the roster (someone asking to join, the owner of another team)
    // shows their photo rather than an initial. The roster still wins for anyone in it.
    const actorId = actor?.userId;
    const actorName = actor?.userName;
    const actorAvatar = actor?.avatarImgPath;
    useEffect(() => {
        if (actorId && actorAvatar) {
            rememberPeople([{ userId: actorId, userName: actorName, avatarImgPath: actorAvatar }]);
        }
    }, [actorId, actorName, actorAvatar]);
    let face: ReactNode;
    if (actor && ctx) {
        face = (
            <UserAvatar fallbackName={actor.userName} showPulseDot={false} userId={actor.userId} />
        );
    } else if (actor) {
        face = <BaseAvatar name={actor.userName} />;
    } else if (byGenos) {
        face = <GenosAuthorAvatar />;
    } else {
        face = (
            <BaseAvatar
                data-inbox-tile-tone={tone}
                shape="rounded"
                tone={tone === "neutral" ? "neutral" : tone}
                aria-hidden
            >
                <Icon sx={{ fontSize: 18 }} />
            </BaseAvatar>
        );
    }
    // Opening a profile from the face must not also open the card (`Clickable` in the list).
    return (
        <Box sx={{ display: "flex" }} onClick={(event) => event.stopPropagation()}>
            {face}
        </Box>
    );
};
