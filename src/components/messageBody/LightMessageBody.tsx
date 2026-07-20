/**
 * Read-only message body rendered as plain DOM — no BlockNote, no
 * ProseMirror, no editor instance.
 *
 * Every chat bubble used to mount a full `BnChatPreview` just to DISPLAY
 * text. That costs ~50x a plain node (measured: ~5ms vs ~0.1ms per
 * bubble in jsdom, before real layout and paint), and a chat switch
 * remounts every visible row at once — which is what made switching
 * chats feel slow next to Slack, whose messages are plain DOM.
 *
 * ## Why it mirrors BlockNote's markup exactly
 *
 * The class names and `data-` attributes below are NOT arbitrary: they
 * reproduce, element for element, what a read-only `BlockNoteView`
 * emits (captured from a real render). That is what makes the fast path
 * pixel-identical for free — every existing rule in `@blocknote/core`'s
 * stylesheet and in App.css (`.bn-message-bubble-box-*`, `.bn-editor
 * img`, the `bn-unwrap-*` toggles, the `data-changing-font-demo` font
 * override) keeps applying without being reimplemented or kept in sync.
 *
 * So: when changing this markup, check it against what BlockNote
 * produces, not against what looks reasonable. Structure is the
 * contract.
 *
 * Anything outside the supported vocabulary never reaches here —
 * `MessageBody` routes those messages to `BnChatPreview`. See
 * `lightBodySupport.ts`.
 */

import { Fragment, useState } from "react";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import { Box, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useMentionGroupModal } from "../../context/MentionGroupModalContext";
import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { CustomEmojiImg } from "../editors/CustomEmojiImg";
import {
    GROUP_PALETTE,
    mentionChipSx,
    USER_OTHER_PALETTE,
    USER_SELF_PALETTE,
} from "../editors/Mention";
import { useResolvedUserName } from "../ui/avatars/AvatarContext";

type AnyBlock = Record<string, any>;

export type LightMessageBodyProps = {
    content: AnyBlock[];
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
};

/* ------------------------------------------------------------------ */
/* Inline                                                              */
/* ------------------------------------------------------------------ */

/** User mention chip. Mirrors `CreateMentionSpec`'s render — same
 *  palette objects, same chip style, same click-to-open-profile. */
const MentionChip = ({
    userId,
    userName,
    myself,
    setMyself,
    socket,
    useCM,
    useTEM,
    useUISM,
}: {
    userId: string;
    userName: string;
} & Omit<LightMessageBodyProps, "content">) => {
    const [openUserProfile, setOpenUserProfile] = useState(false);
    const displayName = useResolvedUserName(userId, userName);
    const palette = myself.userId === userId ? USER_SELF_PALETTE : USER_OTHER_PALETTE;

    return (
        <>
            <Box sx={mentionChipSx(palette)} onClick={() => setOpenUserProfile(true)}>
                <Typography fontWeight="bold" level="body-sm" sx={{ color: palette.text }}>
                    @{displayName}
                </Typography>
            </Box>
            <UserProfile
                isYou={myself.userId === userId}
                myself={myself}
                openUserProfile={openUserProfile}
                setMyself={setMyself}
                setOpenUserProfile={setOpenUserProfile}
                socket={socket}
                useCM={useCM}
                user={useTEM.teamMemberProfiles[userId]}
                useUISM={useUISM}
            />
        </>
    );
};

/** Group mention chip. Mirrors `CreateMentionGroupSpec`'s render. */
const MentionGroupChip = ({
    groupId,
    groupName,
    memberCount,
}: {
    groupId: string;
    groupName: string;
    memberCount: string;
}) => {
    const { openGroupModal } = useMentionGroupModal();
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const parsed = Number(groupId);
        if (Number.isFinite(parsed) && parsed > 0) openGroupModal(parsed);
    };
    return (
        <Box sx={mentionChipSx(GROUP_PALETTE)} onClick={handleClick}>
            <GroupRoundedIcon sx={{ fontSize: 14, color: GROUP_PALETTE.text, mr: 0.25 }} />
            <Typography fontWeight="bold" level="body-sm" sx={{ color: GROUP_PALETTE.text }}>
                @{groupName}
                {Number(memberCount) > 0 ? ` (${memberCount})` : ""}
            </Typography>
        </Box>
    );
};

/**
 * Wrap a text run in its style markup. Order matters only in that it
 * must produce the same nesting BlockNote does: strong > em > u > s >
 * code, then the colour spans outermost.
 */
function applyTextStyles(text: string, styles: Record<string, any> | undefined) {
    let node: React.ReactNode = text;
    if (!styles) return node;

    if (styles.bold) node = <strong>{node}</strong>;
    if (styles.italic) node = <em>{node}</em>;
    if (styles.underline) node = <u>{node}</u>;
    if (styles.strike) node = <s>{node}</s>;
    if (styles.code) node = <code>{node}</code>;
    if (styles.textColor) {
        node = (
            <span data-style-type="textColor" data-value={styles.textColor}>
                {node}
            </span>
        );
    }
    if (styles.backgroundColor) {
        node = (
            <span data-style-type="backgroundColor" data-value={styles.backgroundColor}>
                {node}
            </span>
        );
    }
    return node;
}

const InlineContent = ({
    items,
    ctx,
}: {
    items: unknown[];
    ctx: Omit<LightMessageBodyProps, "content">;
}) => (
    <>
        {items.map((raw, i) => {
            if (typeof raw === "string") return <Fragment key={i}>{raw}</Fragment>;
            const item = raw as AnyBlock;
            const type = item.type ?? "text";

            if (type === "text") {
                return (
                    <Fragment key={i}>{applyTextStyles(item.text ?? "", item.styles)}</Fragment>
                );
            }
            if (type === "link") {
                return (
                    <a
                        key={i}
                        data-inline-content-type="link"
                        href={item.href}
                        rel="noopener noreferrer nofollow"
                        target="_blank"
                    >
                        <InlineContent ctx={ctx} items={item.content ?? []} />
                    </a>
                );
            }
            if (type === "mention") {
                return (
                    <MentionChip
                        key={i}
                        {...ctx}
                        userId={item.props?.userId ?? ""}
                        userName={item.props?.userName ?? ""}
                    />
                );
            }
            if (type === "mentionGroup") {
                return (
                    <MentionGroupChip
                        key={i}
                        groupId={item.props?.groupId ?? "0"}
                        groupName={item.props?.groupName ?? "group"}
                        memberCount={item.props?.memberCount ?? "0"}
                    />
                );
            }
            if (type === "customEmoji") {
                return <CustomEmojiImg key={i} name={item.props?.name} url={item.props?.url} />;
            }
            // Unreachable — `canRenderLight` gates these out.
            return null;
        })}
    </>
);

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

/** The inline wrapper element differs per block type, matching BlockNote:
 *  headings use `<hN>`, everything else `<p>`. */
function InlineWrapper({
    block,
    ctx,
}: {
    block: AnyBlock;
    ctx: Omit<LightMessageBodyProps, "content">;
}) {
    const content: unknown[] = Array.isArray(block.content) ? block.content : [];
    // BlockNote renders an empty block as a trailing <br>, which is what
    // gives a blank line its height. Without this, empty paragraphs
    // collapse and message spacing drifts from the editor's.
    const inner =
        content.length === 0 ? (
            <br className="ProseMirror-trailingBreak" />
        ) : (
            <InlineContent ctx={ctx} items={content} />
        );

    if (block.type === "heading") {
        const level = Number(block.props?.level) || 1;
        const Tag = (level === 1 ? "h1" : level === 2 ? "h2" : "h3") as "h1" | "h2" | "h3";
        return <Tag className="bn-inline-content">{inner}</Tag>;
    }
    return <p className="bn-inline-content">{inner}</p>;
}

const BlockNode = ({
    block,
    ctx,
}: {
    block: AnyBlock;
    ctx: Omit<LightMessageBodyProps, "content">;
}) => {
    const children: AnyBlock[] = Array.isArray(block.children) ? block.children : [];
    const isCheck = block.type === "checkListItem";
    const checked = block.props?.checked === true || block.props?.checked === "true";

    return (
        <div className="bn-block-outer" data-node-type="blockOuter">
            <div className="bn-block" data-node-type="blockContainer">
                <div
                    className="bn-block-content"
                    data-content-type={block.type}
                    {
                        // BlockNote omits `data-level` at the default level 1 and
                        // only emits it for 2/3. Match that: the heading CSS keys
                        // off the attribute's presence, so emitting it for level 1
                        // is not the no-op it looks like.
                        ...(block.type === "heading" && (Number(block.props?.level) || 1) !== 1
                            ? { "data-level": String(Number(block.props?.level)) }
                            : {})
                    }
                    {...(isCheck ? { "data-checked": String(checked) } : {})}
                    {...(block.props?.textAlignment
                        ? { "data-text-alignment": block.props.textAlignment }
                        : {})}
                >
                    {isCheck && (
                        <div>
                            {/* `defaultChecked`, not `checked`: this is display-
                                only markup with no change handler, and React
                                warns about a controlled checkbox without one. */}
                            <input defaultChecked={checked} type="checkbox" disabled />
                        </div>
                    )}
                    <InlineWrapper block={block} ctx={ctx} />
                </div>
                {children.length > 0 && (
                    <div className="bn-block-group" data-node-type="blockGroup">
                        {children.map((child, i) => (
                            <BlockNode key={i} block={child} ctx={ctx} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */

export const LightMessageBody = ({ content, ...ctx }: LightMessageBodyProps) => {
    // `BnChatPreview` renders `content.slice(0, -1)` — the composer always
    // appends a trailing empty paragraph when saving, and dropping it is
    // what keeps a message from carrying a blank line at the end. Match
    // that exactly or every bubble gains a trailing gap.
    const blocks = content.slice(0, -1);

    return (
        <div className="bn-editor bn-default-styles">
            <div className="bn-block-group" data-node-type="blockGroup">
                {blocks.map((block, i) => (
                    <BlockNode key={i} block={block} ctx={ctx} />
                ))}
            </div>
        </div>
    );
};
