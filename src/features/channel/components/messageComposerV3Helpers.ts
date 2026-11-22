/** Draft cache key. Per-channel for main pane; per-(channel, parent)
 *  for thread reply composer. Prefix isolates from any legacy chat
 *  drafts that share the editorDraftStorage backend. */
export function draftKeyFor(channelId: string, parentId?: string): string {
    return parentId ? `v3-channel:${channelId}:thread:${parentId}` : `v3-channel:${channelId}`;
}

/** Flat-text preview of a BlockNote document for the `body_text`
 *  field. Recursive over content + children so nested list items show
 *  up in the snippet. Mentions render inline as `@name` so the
 *  preview reads naturally in the chat list. Attachments are not
 *  represented yet (the preview would say nothing about them, which
 *  matches the legacy behavior for now). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deriveBodyText(blocks: any[]): string {
    const parts: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walk = (nodes: any[]) => {
        for (const n of nodes) {
            if (Array.isArray(n.content)) {
                for (const c of n.content) {
                    if (typeof c.text === "string") {
                        parts.push(c.text);
                    } else if (c?.type === "mention" && c.props?.userName) {
                        parts.push(`@${c.props.userName}`);
                    } else if (c?.type === "mentionGroup" && c.props?.groupName) {
                        parts.push(`@${c.props.groupName}`);
                    } else if (c?.type === "customEmoji" && c.props?.name) {
                        parts.push(`:${c.props.name}:`);
                    }
                }
            }
            if (Array.isArray(n.children)) walk(n.children);
        }
    };
    walk(blocks);
    return parts.join(" ").replace(/\s+/g, " ").trim();
}
