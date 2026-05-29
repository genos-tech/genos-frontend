/**
 * `MessageBody` — renders a `Message.body` BlockNote-style block array.
 *
 * The body schema is the same BlockNote document tree that the legacy
 * editor produces (see `components/editors/Mention.tsx` for the
 * inline-content spec). Each block has `content: InlineContent[]` and
 * optional `children: Block[]`. Inline content of type `"mention"` and
 * `"mentionGroup"` render as styled chips; everything else falls back
 * to `text`.
 *
 * When the body is empty (or contains no renderable inline content),
 * we fall back to `bodyText` so the proof-of-life surface stays robust
 * to test fixtures and pre-mention messages.
 *
 * Self-mentions (i.e. `mention.props.userId === currentUserId`) render
 * with a distinct tint so the viewer's eye lands on them first.
 */

import type { CSSProperties } from "react";

import { purplePalette } from "../../../theme/purplePalette";

/** Pinned to dark palette — see ChannelListV3.tsx for the rationale. */
const p = purplePalette.dark;

interface MessageBodyProps {
    body: unknown[];
    bodyText: string;
    currentUserId: string | null;
}

/** One inline-content node inside a paragraph. We type narrowly here
 *  because anything else falls through to `bodyText`. */
interface InlineNode {
    type?: string;
    text?: string;
    props?: Record<string, unknown>;
}

interface BlockNode {
    content?: InlineNode[];
    children?: BlockNode[];
}

const MENTION_BASE: CSSProperties = {
    padding: "0 4px",
    margin: "0 2px",
    borderRadius: 4,
    fontWeight: 600,
    fontSize: "0.95em",
    cursor: "pointer",
    display: "inline-block",
};

/** Mentions of someone else — accent purple (matches the chat's
 *  primary brand color so a mention reads as a "link to a person"). */
const MENTION_OTHER: CSSProperties = {
    ...MENTION_BASE,
    background: p.chipBg,
    color: p.accentSoft,
    border: `1px solid ${p.chipBorder}`,
};

/** Self-mentions render in danger tint so the viewer's eye lands on
 *  them first while scanning a long timeline. */
const MENTION_SELF: CSSProperties = {
    ...MENTION_BASE,
    background: p.dangerTintBg,
    color: p.dangerTint,
    border: `1px solid ${p.dangerTintBorder}`,
};

/** Group mentions render in success tint to distinguish them from
 *  user mentions at a glance (one chip = many people). */
const MENTION_GROUP: CSSProperties = {
    ...MENTION_BASE,
    background: p.successTintBg,
    color: p.successTint,
    border: `1px solid ${p.successTintBorder}`,
};

export function MessageBody({ body, bodyText, currentUserId }: MessageBodyProps) {
    const blocks = (Array.isArray(body) ? body : []) as BlockNode[];
    const hasRenderable = blocks.some(blockHasContent);
    if (!hasRenderable) {
        return <>{bodyText}</>;
    }
    return (
        <span data-testid="message-body">
            {blocks.map((block, i) => (
                <BlockSpan key={i} block={block} currentUserId={currentUserId} />
            ))}
        </span>
    );
}

function blockHasContent(block: BlockNode): boolean {
    if (Array.isArray(block?.content) && block.content.length > 0) return true;
    if (Array.isArray(block?.children)) return block.children.some(blockHasContent);
    return false;
}

interface BlockSpanProps {
    block: BlockNode;
    currentUserId: string | null;
}

function BlockSpan({ block, currentUserId }: BlockSpanProps) {
    return (
        <>
            {(block.content ?? []).map((node, i) => (
                <InlineSpan key={i} node={node} currentUserId={currentUserId} />
            ))}
            {(block.children ?? []).map((child, i) => (
                <BlockSpan key={`c-${i}`} block={child} currentUserId={currentUserId} />
            ))}
        </>
    );
}

interface InlineSpanProps {
    node: InlineNode;
    currentUserId: string | null;
}

function InlineSpan({ node, currentUserId }: InlineSpanProps) {
    if (node?.type === "mention") {
        const userId = String(node.props?.userId ?? "");
        const userName = String(node.props?.userName ?? "user");
        const isSelf = currentUserId !== null && userId === currentUserId;
        return (
            <span
                data-testid={`message-body-mention-${userId}`}
                data-self={isSelf ? "true" : "false"}
                style={isSelf ? MENTION_SELF : MENTION_OTHER}
                title={isSelf ? "Mentions you" : `Mentions ${userName}`}
            >
                @{userName}
            </span>
        );
    }
    if (node?.type === "mentionGroup") {
        const groupId = String(node.props?.groupId ?? "");
        const groupName = String(node.props?.groupName ?? "group");
        const memberCount = String(node.props?.memberCount ?? "");
        return (
            <span
                data-testid={`message-body-mention-group-${groupId}`}
                style={MENTION_GROUP}
                title={memberCount ? `${memberCount} members` : groupName}
            >
                @{groupName}
            </span>
        );
    }
    return <span>{node?.text ?? ""}</span>;
}
