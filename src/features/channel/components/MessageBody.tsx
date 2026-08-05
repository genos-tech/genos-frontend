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

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { fmt, useTranslation } from "../../../i18n";

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

const MENTION_OTHER: CSSProperties = {
    ...MENTION_BASE,
    background: "rgba(59, 130, 246, 0.16)",
    color: "#1d4ed8",
};

const MENTION_SELF: CSSProperties = {
    ...MENTION_BASE,
    background: "rgba(239, 68, 68, 0.18)",
    color: "#b91c1c",
};

const MENTION_GROUP: CSSProperties = {
    ...MENTION_BASE,
    background: "rgba(34, 197, 94, 0.16)",
    color: "#16a34a",
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
                <InlineSpan key={i} currentUserId={currentUserId} node={node} />
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
    const { t } = useTranslation();
    if (node?.type === "mention") {
        const userId = String(node.props?.userId ?? "");
        const userName = String(node.props?.userName ?? "user");
        const isSelf = currentUserId !== null && userId === currentUserId;
        return (
            <AppTooltip
                title={
                    isSelf
                        ? t.chat.channel.body.mentionsYou
                        : fmt(t.chat.channel.body.mentionsUser, { name: userName })
                }
            >
                <span
                    data-self={isSelf ? "true" : "false"}
                    data-testid={`message-body-mention-${userId}`}
                    style={isSelf ? MENTION_SELF : MENTION_OTHER}
                >
                    @{userName}
                </span>
            </AppTooltip>
        );
    }
    if (node?.type === "mentionGroup") {
        const groupId = String(node.props?.groupId ?? "");
        const groupName = String(node.props?.groupName ?? "group");
        const memberCount = String(node.props?.memberCount ?? "");
        return (
            <AppTooltip
                title={
                    memberCount
                        ? fmt(t.chat.channel.body.groupMembers, { count: memberCount })
                        : groupName
                }
            >
                <span data-testid={`message-body-mention-group-${groupId}`} style={MENTION_GROUP}>
                    @{groupName}
                </span>
            </AppTooltip>
        );
    }
    if (node?.type === "customEmoji") {
        const name = String(node.props?.name ?? "");
        const url = String(node.props?.url ?? "");
        if (url) {
            return (
                <AppTooltip title={`:${name}:`}>
                    <img
                        alt={`:${name}:`}
                        data-testid={`message-body-custom-emoji-${name}`}
                        loading="lazy"
                        src={url}
                        style={{
                            height: "1.4em",
                            width: "auto",
                            verticalAlign: "text-bottom",
                            objectFit: "contain",
                            display: "inline-block",
                        }}
                    />
                </AppTooltip>
            );
        }
        return <span>{name ? `:${name}:` : ""}</span>;
    }
    return <span>{node?.text ?? ""}</span>;
}
