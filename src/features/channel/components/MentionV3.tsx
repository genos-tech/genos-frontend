/**
 * v3-native BlockNote inline content spec for `@mention` chips.
 *
 * Difference from the legacy `Mention.tsx` spec: zero coupling to the
 * legacy hook stack (`useTEM`, `useCM`, `useUISM`, the legacy `socket`).
 * Click is a no-op for now — the UserProfile modal port is a separate
 * follow-on slice; not having it isn't load-bearing for the composer
 * working end-to-end.
 *
 * Wire shape is intentionally identical to the legacy spec so the
 * backend's mention extractor (`origin/services/mention_extractor.py`)
 * already recognizes these nodes — that's load-bearing because the
 * server creates `MessageMention` rows from the body on every send/
 * edit (see the session work that wired that up), and changing the
 * field names here would silently break the @-you indicator + inbox
 * routing.
 *
 * Self-mention highlighting reads `currentUserId` at spec-creation
 * time. The spec is memoized per currentUserId in the composer so it
 * stays stable across re-renders.
 */

import { createReactInlineContentSpec } from "@blocknote/react";

const SELF_BG = "rgba(0, 100, 200, 0.15)";
const SELF_FG = "#1e40af";
const OTHER_BG = "rgba(0, 0, 0, 0.06)";
const OTHER_FG = "#374151";
const GROUP_BG = "rgba(34, 197, 94, 0.12)";
const GROUP_FG = "#16a34a";

export const createMentionSpecV3 = (currentUserId: string | null) =>
    createReactInlineContentSpec(
        {
            type: "mention",
            propSchema: {
                userId: { default: "N/A" },
                userName: { default: "N/A" },
            },
            content: "none",
        },
        {
            render: (props) => {
                const { userId, userName } = props.inlineContent.props;
                const isMe = !!currentUserId && userId === currentUserId;
                return (
                    <span
                        data-testid={`mention-chip-v3-${userId}`}
                        data-is-self={isMe ? "true" : "false"}
                        style={{
                            background: isMe ? SELF_BG : OTHER_BG,
                            color: isMe ? SELF_FG : OTHER_FG,
                            padding: "0 6px",
                            borderRadius: 4,
                            fontWeight: 500,
                            display: "inline",
                        }}
                    >
                        @{userName}
                    </span>
                );
            },
        }
    );

/**
 * v3-native `@mentionGroup` chip. Currently a static display only —
 * the group-resolution backend work (UUID-vs-BigAutoField schema fix)
 * is on the roadmap but not shipped, so this only renders if the body
 * already contains a `mentionGroup` node (e.g. from a legacy message
 * round-tripping through v3). The composer's picker does not insert
 * these yet.
 */
export const createMentionGroupSpecV3 = () =>
    createReactInlineContentSpec(
        {
            type: "mentionGroup",
            propSchema: {
                groupId: { default: "0" },
                groupName: { default: "group" },
                memberCount: { default: "0" },
            },
            content: "none",
        },
        {
            render: (props) => {
                const { groupId, groupName, memberCount } = props.inlineContent.props;
                const countN = Number(memberCount);
                return (
                    <span
                        data-testid={`mention-group-chip-v3-${groupId}`}
                        style={{
                            background: GROUP_BG,
                            color: GROUP_FG,
                            padding: "0 6px",
                            borderRadius: 4,
                            fontWeight: 500,
                            display: "inline",
                        }}
                    >
                        @{groupName}
                        {countN > 0 ? ` (${countN})` : ""}
                    </span>
                );
            },
        }
    );
