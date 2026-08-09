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

import { Fragment, useMemo, useRef, useState } from "react";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import { Box, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../context/AuthContext";
import { useMentionGroupModal } from "../../context/MentionGroupModalContext";
import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { LinkedPrCard } from "../../features/integrations/components/LinkedPrCard";
import { extractPrUrlsFromBlocks } from "../../features/integrations/utils/extractPrUrls";
import { TaskMentionHoverCard } from "../../features/tasks/components/TaskMentionHoverCard";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useProtectedMediaSrc } from "../../hooks/common/useProtectedMediaSrc";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { downloadFile } from "../../utils/downloadUtils";
import { entityRefToHref, HashEntityRef } from "../../utils/entityHref";
import { CustomEmojiImg } from "../editors/CustomEmojiImg";
import {
    CHAT_PALETTE,
    hashMentionTextSx,
    NOTE_PALETTE,
    PROJECT_PALETTE,
    TASK_PALETTE,
} from "../editors/HashMention";
import {
    GROUP_PALETTE,
    mentionChipSx,
    MentionPalette,
    USER_OTHER_PALETTE,
    USER_SELF_PALETTE,
} from "../editors/Mention";
import { AppTooltip } from "../ui/AppTooltip";
import { useResolvedUserName } from "../ui/avatars/AvatarContext";
import { isJumboEmojiBody } from "./emojiOnlyBody";
import { ImageZoomModal } from "./ImageZoomModal";

type AnyBlock = Record<string, any>;

// Same cap `BnChatPreview` uses — anyone pasting more PR links than this
// is abusing the channel; the rest are silently dropped.
const MAX_PR_UNFURLS = 4;

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

/**
 * User mention chip. Mirrors `CreateMentionSpec`'s render — same palette
 * objects, same chip style, same click-to-open-profile.
 *
 * EVERY element a chip renders must be inline (`component="span"`).
 * Inline content lives inside the block's `<p class="bn-inline-content">`,
 * and Joy defaults would emit `<div>` (Box) and `<p>` (Typography), which
 * are both illegal inside a `<p>` — React logs "cannot be a descendant of
 * <p>" and the browser's parser would close the paragraph early.
 *
 * The BlockNote path gets away with the same Joy defaults only because
 * ProseMirror mounts custom inline specs into a detached container, so
 * the invalid nesting is assembled by DOM APIs rather than by parsing.
 * Rendering one contiguous React tree here removes that accident, so the
 * markup has to actually be valid. See the nesting test in
 * `lightMessageBody.test.tsx`.
 */
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
            <Box
                component="span"
                sx={mentionChipSx(palette)}
                onClick={() => setOpenUserProfile(true)}
            >
                <Typography
                    component="span"
                    fontWeight="bold"
                    level="body-sm"
                    sx={{ color: palette.text }}
                >
                    @{displayName}
                </Typography>
            </Box>
            {/* Mounted only once opened. The BlockNote spec renders this
                unconditionally, which means one whole modal component tree
                per mention in the viewport — pure waste for a dialog that
                is closed ~always, and the reason a mention used to drag
                AuthProvider into places that only wanted to show text. */}
            {openUserProfile && (
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
            )}
        </>
    );
};

/**
 * `#` entity chip — styled inline TEXT (not a pill), mirroring
 * `HashMention`'s `HashChip`. Uses the SAME exported palettes and
 * `hashMentionTextSx` so it reads identically to the editor path.
 *
 * `component="span"` (not the Box default `<div>`) because this lives
 * inside `<p class="bn-inline-content">` — see the `MentionChip` note.
 */
const LightHashChip = ({
    href,
    label,
    palette,
}: {
    href: string;
    label: string;
    palette: MentionPalette;
}) => {
    const urlLinkModal = useUrlLinkModal();
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        urlLinkModal?.openModalByHref(href);
    };
    return (
        <Box component="span" sx={hashMentionTextSx(palette)} onClick={handleClick}>
            #{label}
        </Box>
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
        <Box component="span" sx={mentionChipSx(GROUP_PALETTE)} onClick={handleClick}>
            <GroupRoundedIcon sx={{ fontSize: 14, color: GROUP_PALETTE.text, mr: 0.25 }} />
            <Typography
                component="span"
                fontWeight="bold"
                level="body-sm"
                sx={{ color: GROUP_PALETTE.text }}
            >
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
            if (type === "hashTask") {
                const p = item.props ?? {};
                const idText = p.displayId || p.taskId || "";
                const label = p.title ? `${idText} · ${p.title}` : idText;
                const href = entityRefToHref({
                    entityType: "task",
                    projectId: p.projectId ?? "",
                    taskId: p.taskId ?? "",
                });
                // Hovercard parity with the editor path. `AppTooltip`
                // renders `title` lazily on hover, so `TaskMentionHoverCard`
                // (which fetches task status) never mounts until hovered —
                // no per-bubble cost at rest. Bare <span> anchor: Joy's
                // Tooltip clones its child and injects props that would
                // clobber the styled chip.
                return (
                    <AppTooltip
                        key={i}
                        enterDelay={250}
                        placement="top-start"
                        surface="none"
                        title={
                            <TaskMentionHoverCard
                                displayId={idText}
                                projectId={p.projectId ?? ""}
                                taskId={p.taskId ?? ""}
                                title={p.title ?? ""}
                            />
                        }
                    >
                        <span>
                            <LightHashChip href={href} label={label} palette={TASK_PALETTE} />
                        </span>
                    </AppTooltip>
                );
            }
            if (type === "hashNote") {
                const p = item.props ?? {};
                const noteId = p.noteId ?? "";
                let ref: HashEntityRef;
                if (p.noteKind === "task") {
                    ref = {
                        entityType: "note",
                        noteKind: "task",
                        projectId: p.projectId ?? "",
                        taskId: p.taskId ?? "",
                        noteId,
                    };
                } else if (p.noteKind === "chat") {
                    ref = {
                        entityType: "note",
                        noteKind: "chat",
                        chatType: p.chatType || "gm",
                        chatId: p.chatId ?? "",
                        threadId: p.threadId || "0",
                        noteId,
                    };
                } else if (p.noteKind === "shared") {
                    ref = { entityType: "note", noteKind: "shared", noteId };
                } else if (p.noteKind === "team") {
                    ref = { entityType: "note", noteKind: "team", noteId };
                } else {
                    ref = { entityType: "note", noteKind: "my", noteId };
                }
                return (
                    <LightHashChip
                        key={i}
                        href={entityRefToHref(ref)}
                        label={p.title || "note"}
                        palette={NOTE_PALETTE}
                    />
                );
            }
            if (type === "hashChat") {
                const p = item.props ?? {};
                const href = entityRefToHref({
                    entityType: "chat",
                    chatType: "gm",
                    chatId: p.chatId ?? "",
                });
                return (
                    <LightHashChip
                        key={i}
                        href={href}
                        label={p.chatName || "chat"}
                        palette={CHAT_PALETTE}
                    />
                );
            }
            if (type === "hashProject") {
                const p = item.props ?? {};
                const href = entityRefToHref({
                    entityType: "project",
                    projectId: p.projectId ?? "",
                });
                return (
                    <LightHashChip
                        key={i}
                        href={href}
                        label={p.projectName || "project"}
                        palette={PROJECT_PALETTE}
                    />
                );
            }
            // Unreachable — `canRenderLight` gates these out.
            return null;
        })}
    </>
);

/* ------------------------------------------------------------------ */
/* Media blocks                                                        */
/* ------------------------------------------------------------------ */

// Verbatim copy of BlockNote's file-block icon (`createFileNameWithIcon`'s
// `rn`). Copied so `.bn-file-icon` renders the same glyph the editor path
// does; keep byte-identical if it's ever refreshed.
const FILE_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 8L9.00319 2H19.9978C20.5513 2 21 2.45531 21 2.9918V21.0082C21 21.556 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5501 3 20.9932V8ZM10 4V9H5V20H19V4H10Z"></path></svg>';

/**
 * File-name-with-icon markup shared by `LightFileBlock` and the
 * `showPreview: false` image case. Mirrors BlockNote's `an`:
 * `.bn-file-name-with-icon > (.bn-file-icon > svg) + p.bn-file-name`.
 * Clicking downloads, exactly as `BnChatPreview`'s delegated file handler
 * does — but wired directly here since the light path emits no `data-id`.
 */
const FileNameWithIcon = ({ url, name }: { url?: string; name?: string }) => (
    <div
        className="bn-file-name-with-icon"
        style={{ cursor: "pointer" }}
        onClick={() => {
            if (url) downloadFile(url, name || undefined);
        }}
    >
        <div className="bn-file-icon" dangerouslySetInnerHTML={{ __html: FILE_ICON_SVG }} />
        <p className="bn-file-name">{name}</p>
    </div>
);

/**
 * Image block, plain DOM. Mirrors BlockNote's read-only image markup so
 * the `@blocknote/core` + App.css rules keyed on these classes apply:
 * `.bn-file-block-content-wrapper > .bn-visual-media-wrapper >
 * img.bn-visual-media`.
 *
 * Two things a hand-written `<img>` needs that the editor got for free:
 *  - protected `/media/` URLs must be resolved to a blob first, else the
 *    browser fires a request that 401s and shows a broken image —
 *    `useProtectedMediaSrc` is exactly that seam (public URLs like Giphy
 *    resolve synchronously, so they never flicker).
 *  - reserved vertical space until decode, so the row doesn't grow on
 *    first scroll and make Virtuoso re-measure (the "first scroll janky,
 *    second smooth" report). `data-media-loaded` drops the reservation on
 *    load — see the `.bn-visual-media-wrapper` rule in App.css.
 */
const LightImageBlock = ({
    block,
    onImageZoom,
}: {
    block: AnyBlock;
    onImageZoom: (src: string) => void;
}) => {
    const props = block.props ?? {};
    const src = useProtectedMediaSrc(props.url);
    const [loaded, setLoaded] = useState(false);
    const showPreview = props.showPreview !== false;

    // A resized image stores its width; height stays unknown, so the CSS
    // reservation carries the height. `fit-content` matches the editor's
    // default so an un-resized image is sized by its intrinsic width
    // (clamped by `.bn-editor img`).
    const wrapperWidth =
        typeof props.previewWidth === "number" ? `${props.previewWidth}px` : "fit-content";

    if (!showPreview) {
        // BlockNote renders an image with preview disabled as a file chip.
        // The caption sits INSIDE the content wrapper (BlockNote appends it
        // to the same div, not as a sibling) — matters for the
        // `[data-file-block] .bn-file-caption` rule to apply.
        return (
            <div className="bn-file-block-content-wrapper">
                <FileNameWithIcon name={props.name} url={props.url} />
                {props.caption && <p className="bn-file-caption">{props.caption}</p>}
            </div>
        );
    }

    return (
        <div className="bn-file-block-content-wrapper" style={{ width: wrapperWidth }}>
            <div className="bn-visual-media-wrapper" data-media-loaded={loaded ? "true" : "false"}>
                {src && (
                    <img
                        className="bn-visual-media"
                        alt={props.name || props.caption || "BlockNote image"}
                        contentEditable={false}
                        draggable={false}
                        src={src}
                        onClick={() => onImageZoom(src)}
                        onLoad={() => setLoaded(true)}
                    />
                )}
            </div>
            {props.caption && <p className="bn-file-caption">{props.caption}</p>}
        </div>
    );
};

/** File block, plain DOM. Mirrors BlockNote's `render` → file-name path.
 *  Caption is a CHILD of the content wrapper, matching BlockNote. */
const LightFileBlock = ({ block }: { block: AnyBlock }) => {
    const props = block.props ?? {};
    return (
        <div className="bn-file-block-content-wrapper">
            <FileNameWithIcon name={props.name} url={props.url} />
            {props.caption && <p className="bn-file-caption">{props.caption}</p>}
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

/** The inline wrapper element differs per block type, matching BlockNote:
 *  headings use `<hN>`, quotes `<blockquote>`, everything else `<p>`. */
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
    // A quote's inline content goes straight into a `<blockquote>` — the
    // block's spec returns that one element as BOTH `dom` and `contentDOM`,
    // so unlike every other block there is no inner `<p>`. The element is
    // the whole styling contract: `@blocknote/core`'s only quote rule is
    // `[data-content-type=quote] blockquote`, so a `<p>` here left a quote
    // painted exactly like the paragraph above it.
    if (block.type === "quote") {
        return <blockquote className="bn-inline-content">{inner}</blockquote>;
    }
    return <p className="bn-inline-content">{inner}</p>;
}

const BlockNode = ({
    block,
    ctx,
    onImageZoom,
}: {
    block: AnyBlock;
    ctx: Omit<LightMessageBodyProps, "content">;
    onImageZoom: (src: string) => void;
}) => {
    const children: AnyBlock[] = Array.isArray(block.children) ? block.children : [];
    const isCheck = block.type === "checkListItem";
    const checked = block.props?.checked === true || block.props?.checked === "true";
    const isMedia = block.type === "image" || block.type === "file";

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
                    {
                        // BlockNote stamps a bare `data-file-block` on every
                        // media block-content (image/file/video/audio). CSS in
                        // Block.css keys the wrapper's cursor/layout off it.
                        ...(isMedia ? { "data-file-block": "" } : {})
                    }
                    {...(block.props?.textAlignment
                        ? { "data-text-alignment": block.props.textAlignment }
                        : {})}
                >
                    {block.type === "image" ? (
                        <LightImageBlock block={block} onImageZoom={onImageZoom} />
                    ) : block.type === "file" ? (
                        <LightFileBlock block={block} />
                    ) : (
                        <>
                            {isCheck && (
                                <div>
                                    {/* `defaultChecked`, not `checked`: this is
                                        display-only markup with no change handler,
                                        and React warns about a controlled checkbox
                                        without one. */}
                                    <input defaultChecked={checked} type="checkbox" disabled />
                                </div>
                            )}
                            <InlineWrapper block={block} ctx={ctx} />
                        </>
                    )}
                </div>
                {children.length > 0 && (
                    <div className="bn-block-group" data-node-type="blockGroup">
                        {children.map((child, i) => (
                            <BlockNode key={i} block={child} ctx={ctx} onImageZoom={onImageZoom} />
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
    // Memoized so it keeps a stable identity for the emoji-only check
    // below (a fresh slice every render would defeat that memo).
    const blocks = useMemo(() => content.slice(0, -1), [content]);

    // Anchor clicks open the in-app URL modal instead of navigating away.
    // This has to live here rather than in `MessageBody`, whose fallback
    // branch returns before the light path — hooks there would be
    // conditional. The ref sits on the `.bn-editor` root below, an
    // ancestor of every `<a>` this renders. Null provider (signin/signup)
    // degrades to normal link behaviour, same as the editor path.
    const urlLinkModal = useUrlLinkModal();
    const editorBoxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(editorBoxRef, urlLinkModal);

    // GitHub PR links unfurl to a card under the body. Mirrors
    // `BnChatPreview`; `extractPrUrlsFromBlocks` reads both link nodes
    // and raw URLs sitting in plain text, so a message that is otherwise
    // pure text still unfurls.
    const { accessToken } = useAuth();
    const prUrls = useMemo(
        () => extractPrUrlsFromBlocks(content).slice(0, MAX_PR_UNFURLS),
        [content]
    );

    // A message that is nothing but emoji renders enlarged (Slack-style).
    // The class goes on THIS wrapper, not on `.bn-editor`, because
    // everything from `.bn-editor` down is the mirrored-BlockNote markup
    // this file promises to keep identical — the wrapper is ours. The
    // scaling itself is a single `font-size` bump in App.css: unicode
    // emoji are text, and `CustomEmojiImg` sizes itself in `em`, so both
    // grow from the one rule.
    const isJumboEmoji = useMemo(() => isJumboEmojiBody(blocks), [blocks]);

    // Click-to-zoom lightbox for an image block. `null` = closed. Owned here
    // (not per-block) so a single modal serves every image in the body,
    // matching `BnChatPreview`. Threaded down to `LightImageBlock` via
    // `onImageZoom`; the resolved (blob/public) src is what gets stored.
    const [zoomSrc, setZoomSrc] = useState<string | null>(null);

    return (
        <div ref={editorBoxRef} className={isJumboEmoji ? "bn-emoji-only-body" : undefined}>
            <div className="bn-editor bn-default-styles">
                <div className="bn-block-group" data-node-type="blockGroup">
                    {blocks.map((block, i) => (
                        <BlockNode key={i} block={block} ctx={ctx} onImageZoom={setZoomSrc} />
                    ))}
                </div>
            </div>

            {prUrls.length > 0 && accessToken && (
                <Stack spacing={0.75} sx={{ mt: 0.75, mb: 0.5 }}>
                    {prUrls.map((url) => (
                        <LinkedPrCard
                            key={url}
                            accessToken={accessToken}
                            url={url}
                            hideOnNotConnected
                        />
                    ))}
                </Stack>
            )}

            <ImageZoomModal src={zoomSrc} onClose={() => setZoomSrc(null)} />
        </div>
    );
};
