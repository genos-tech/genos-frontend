/**
 * BlockNote-based composer for the v3 messaging surface.
 *
 * Replaces the proof-of-life `<input type="text">` that lived inline
 * in `MessagesPaneV3`. The plain input couldn't carry formatting,
 * inline mention chips, or anything other than a single line of text.
 * This composer:
 *
 *   - Wraps a BlockNote editor with the v3 mention spec.
 *   - Wires `@`-trigger picker to the channel's member roster from
 *     `channelService` (no team-wide member lookup needed for v3 —
 *     channel membership is the relevant cohort for v3 contexts).
 *   - Persists drafts per-(channel, optional parent) so unsent typing
 *     survives channel-switches.
 *   - Sends via `channelService.send(channelId, body, opts)` and
 *     uploads attachments after the message ack lands.
 *   - Cmd/Ctrl+Enter sends. Plain Enter inserts a newline (BlockNote
 *     default).
 *
 * Output body shape: the BlockNote document is sent verbatim as
 * `body` — `channelService` already accepts it, and the backend's
 * mention extractor parses `mention` inline content nodes out of the
 * same shape (see the session's mention-extraction work).
 *
 * `body_text` is derived client-side as a flat preview string used
 * by the chat list ("latest message" snippet) and inbox routing. We
 * include mention names (`@alice`) inline so the preview reads
 * naturally; attachments are NOT in the preview yet (deferred until
 * the bubble's attachment rendering parity work).
 *
 * Scope deferred to follow-on slices:
 *   - Mention groups (`@team-leads`) — needs the backend schema fix.
 *   - Click-to-show-UserProfile on mention chips.
 *   - Slash menu customization, custom emoji picker, wrap toggles.
 *   - BlockNote-inline image/file upload (we stage via
 *     `useAttachmentDraft` instead — the BlockNote inline path
 *     would race against the file-strip and double-upload).
 */

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
    BlockNoteSchema,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
    filterSuggestionItems,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
    DefaultReactSuggestionItem,
    SuggestionMenuController,
    useCreateBlockNote,
} from "@blocknote/react";

import { useEditorDraft } from "../../../hooks/common/useEditorDraft";
import { channelService, ChannelServiceError } from "../../../services/channel/channelService";
import { useAttachmentDraft } from "../hooks/useAttachmentDraft";
import { createMentionGroupSpecV3, createMentionSpecV3 } from "./MentionV3";
import { PendingAttachmentStrip } from "./PendingAttachmentStrip";

export interface MessageComposerV3Props {
    channelId: string;
    /** If set, the composer sends thread replies under this parent
     *  message id. The draft is keyed separately from the main
     *  composer so the user can have separate in-progress text in
     *  each surface. */
    parentId?: string;
    /** Current viewer's user id, for self-mention highlighting and
     *  draft scoping. May be null pre-auth. */
    currentUserId: string | null;
    /** Called after a successful send with the server-issued message id.
     *  Caller wires this to scroll-to-bottom / focus-restore. */
    onSendComplete?: (messageId: string) => void;
    /** Called with a user-readable string when send or attachment
     *  upload fails. Caller renders the message however it wants
     *  (alert, snackbar, inline banner). */
    onError?: (message: string) => void;
    /** Optional placeholder shown by BlockNote in the empty editor.
     *  Defaults to a generic prompt. */
    placeholder?: string;
    /** Prefix for `data-testid` attributes on interactive elements
     *  (file input, attach button, send button, pending strip). Lets
     *  the parent surface keep stable selectors when the composer is
     *  mounted inside a larger pane. Defaults to `message-composer-v3`. */
    testIdPrefix?: string;
}

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
                    }
                }
            }
            if (Array.isArray(n.children)) walk(n.children);
        }
    };
    walk(blocks);
    return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** True if a BlockNote document has anything more than a single empty
 *  paragraph. BlockNote represents "empty" as `[{type: paragraph,
 *  content: []}]` (length 1, empty content). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasContent(blocks: any[]): boolean {
    if (blocks.length > 1) return true;
    const first = blocks[0];
    if (!first || !Array.isArray(first.content)) return false;
    return first.content.length > 0;
}

export function MessageComposerV3({
    channelId,
    parentId,
    currentUserId,
    onSendComplete,
    onError,
    placeholder = "Message…  (type @ to mention, Cmd+Enter to send)",
    testIdPrefix = "message-composer-v3",
}: MessageComposerV3Props) {
    // Subscribe to channelService so the mention picker stays in sync
    // with live `channel.member_added` / `channel.member_removed`
    // broadcasts. Reading members on every render is cheap (small map
    // lookup) compared to memoizing on a snapshot reference.
    const snapshot = useSyncExternalStore(
        channelService.subscribe,
        channelService.getSnapshot,
        channelService.getSnapshot
    );
    const members = snapshot.membersByChannel.get(channelId) ?? [];

    // Build the schema once per (currentUserId, placeholder). The
    // mention spec captures currentUserId at creation time for the
    // self-highlight render branch.
    const schema = useMemo(() => {
        const { audio, video, ...remaining } = defaultBlockSpecs;
        void audio;
        void video;
        return BlockNoteSchema.create({
            inlineContentSpecs: {
                ...defaultInlineContentSpecs,
                mention: createMentionSpecV3(currentUserId),
                mentionGroup: createMentionGroupSpecV3(),
            },
            blockSpecs: remaining,
        });
    }, [currentUserId]);

    const editor = useCreateBlockNote({
        schema,
        dictionary: {
            placeholders: {
                emptyDocument: placeholder,
                default: "",
                heading: "",
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
    });

    const draftKey = useMemo(() => draftKeyFor(channelId, parentId), [channelId, parentId]);
    const { saveDraft, clearDraft } = useEditorDraft(editor, draftKey);

    const attachments = useAttachmentDraft();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [busy, setBusy] = useState(false);

    /** Send the current document. Idempotent against rapid double-clicks
     *  via the `busy` lock — channelService's pending-queue would
     *  dedupe at the correlation_id layer if a duplicate did slip
     *  through, but we'd rather not stage two pending entries. */
    const send = useCallback(async () => {
        const blocks = editor.document;
        const hasAttachments = attachments.pending.some((p) => p.error === null);
        if (!hasContent(blocks) && !hasAttachments) return;

        setBusy(true);
        try {
            const bodyText = deriveBodyText(blocks);
            const msg = await channelService.send(channelId, blocks, { bodyText, parentId });
            // Upload attachments AFTER the message exists. If the ack
            // didn't echo the message (older server shape), skip the
            // uploads — the user can retry once the broadcast lands.
            if (msg && hasAttachments) {
                const report = await attachments.uploadAll(channelId, msg.id);
                if (report.failed.length > 0 && onError) {
                    onError(
                        `Uploaded ${report.succeeded}, ${report.failed.length} failed: ` +
                            report.failed.map((f) => f.error).join("; ")
                    );
                }
            }
            // Clear the editor + draft on a clean send. Pending strip
            // is only reset when there are no remaining errors — failed
            // uploads stay visible so the user can retry without
            // re-picking the files.
            editor.replaceBlocks(editor.document, []);
            clearDraft();
            if (!hasAttachments || attachments.pending.length === 0) {
                attachments.reset();
            }
            if (msg) onSendComplete?.(msg.id);
        } catch (e) {
            const err = e as ChannelServiceError;
            onError?.(`${err.code ?? "ERROR"}: ${err.message ?? String(e)}`);
        } finally {
            setBusy(false);
        }
    }, [editor, channelId, parentId, attachments, clearDraft, onSendComplete, onError]);

    const getMentionItems = useCallback(
        async (query: string): Promise<DefaultReactSuggestionItem[]> => {
            // PUNCH LIST: v3 `ChannelMember` only carries `userId / role /
            // tsJoined` — display name isn't joined into the member row
            // yet (see `v3ToLegacy.ts`). Read `userName` defensively so
            // this picks up the field once `ChannelMember` is extended.
            const items: DefaultReactSuggestionItem[] = members.map((m) => {
                const displayName = (m as { userName?: string }).userName ?? m.userId;
                return {
                    title: displayName,
                    onItemClick: () => {
                        editor.insertInlineContent([
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            {
                                type: "mention",
                                props: { userId: m.userId, userName: displayName },
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            } as any,
                            " ",
                        ]);
                    },
                };
            });
            return filterSuggestionItems(items, query);
        },
        [editor, members]
    );

    const hasAttachments = attachments.pending.some((p) => p.error === null);

    return (
        <>
            <PendingAttachmentStrip
                pending={attachments.pending}
                onRemove={attachments.removeAt}
                testIdPrefix={testIdPrefix}
            />
            <div
                style={{
                    display: "flex",
                    alignItems: "stretch",
                    gap: 8,
                    padding: "8px 12px",
                    borderTop: "1px solid #ddd",
                    background: "#fff",
                }}
                data-testid={testIdPrefix}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => {
                        attachments.addFiles(e.target.files);
                        // Reset the input so re-picking the same file
                        // after a remove still fires onChange.
                        e.target.value = "";
                    }}
                    style={{ display: "none" }}
                    data-testid={`${testIdPrefix}-file-input`}
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    title="Attach file(s)"
                    style={{
                        alignSelf: "flex-end",
                        marginBottom: 4,
                        fontSize: 16,
                        padding: "4px 8px",
                    }}
                    data-testid={`${testIdPrefix}-attach`}
                >
                    📎
                </button>
                <div
                    style={{ flex: 1, minWidth: 0 }}
                    data-testid={`${testIdPrefix}-editor-host`}
                    onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            void send();
                        }
                    }}
                >
                    <BlockNoteView
                        editor={editor}
                        emojiPicker={false}
                        formattingToolbar={true}
                        sideMenu={false}
                        slashMenu={true}
                        onChange={() => saveDraft(editor.document)}
                    >
                        <SuggestionMenuController
                            triggerCharacter="@"
                            getItems={getMentionItems}
                        />
                    </BlockNoteView>
                </div>
                <button
                    type="button"
                    onClick={() => void send()}
                    disabled={
                        busy ||
                        attachments.isUploading ||
                        (!hasContent(editor.document) && !hasAttachments)
                    }
                    style={{ alignSelf: "flex-end", marginBottom: 4 }}
                    data-testid={`${testIdPrefix}-send`}
                >
                    {attachments.isUploading ? "Uploading…" : "Send"}
                </button>
            </div>
        </>
    );
}
