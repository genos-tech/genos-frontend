import { useResolvedUserName } from "../../../components/ui/avatars/AvatarContext";

/** The chip. A component of its own so the live-name hook is legal in the
 *  BlockNote `render` callback. The name typed into the text is a snapshot, and
 *  for a deleted account it is the real name that must no longer show: the
 *  resolver reads "Deleted user" there (MIP-1797). */
export const MentionChipV3 = ({
    userId,
    storedName,
    isMe,
    background,
    color,
}: {
    userId: string;
    storedName: string;
    isMe: boolean;
    background: string;
    color: string;
}) => {
    const userName = useResolvedUserName(userId, storedName);
    return (
        <span
            data-is-self={isMe ? "true" : "false"}
            data-testid={`mention-chip-v3-${userId}`}
            style={{
                background,
                color,
                padding: "0 6px",
                borderRadius: 4,
                fontWeight: 500,
                display: "inline",
            }}
        >
            @{userName}
        </span>
    );
};
