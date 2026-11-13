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

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { DefaultReactSuggestionItem, SuggestionMenuController } from "@blocknote/react";

import { useBlockNoteDictionary } from "../../../components/editors/blockNoteI18n";
import {
    isSendShortcut,
    useChatComposer,
} from "../../../components/editors/composer/useChatComposer";
import { createGenosSchema } from "../../../components/editors/genos/genosSchema";
import { HashSuggestionMenuController } from "../../../components/editors/HashMention";
import { hasSendableContent } from "../../../components/editors/utils/messageBlocks";
import { AppTooltip } from "../../../components/ui/AppTooltip";
import { useTranslation } from "../../../i18n";
import { channelService, ChannelServiceError } from "../../../services/channel/channelService";
import type { Message } from "../../../types/channel";
import { filterAndRankSuggestionItems } from "../../../utils/suggestionRanking";
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

export function MessageComposerV3({
    channelId,
    parentId,
    currentUserId,
    onSendComplete,
    onError,
    placeholder = "Message…  (type @ to mention, Cmd+Enter to send)",
    testIdPrefix = "message-composer-v3",
}: MessageComposerV3Props) {
    const { t } = useTranslation();
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
    const schema = useMemo(
        () =>
            createGenosSchema({
                mention: createMentionSpecV3(currentUserId),
                mentionGroup: createMentionGroupSpecV3(),
            }),
        [currentUserId]
    );

    const attachments = useAttachmentDraft();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const hasAttachments = attachments.pending.some((p) => p.error === null);

    // Draft, editor, chord and send flow come from the shared composer hook. The same editing
    // rules as every composer (Tab indents, the ``` fence rule that keeps an unknown typed
    // language from wedging the highlighted code block, the link-host caption) come with its
    // `composer` surface. What differs on purpose here: the text stays in the editor until the
    // request is acked (`clear: "after"`), staged attachments count as content, and there is
    // no inline upload (the strip stages files). Emptiness is the shared `hasSendableContent`
    // (a lone space is not a message), tracked on change like every composer (MIP-1224).
    // The shared dictionary (translated toolbar, no "Mod+K" hint under the link button since
    // Cmd/Ctrl+K opens Spotlight everywhere: MIP-1310 / MIP-1392), with this composer's own
    // placeholders: the hint text in the empty editor, none on a non-empty line or heading.
    // It used to pass only `placeholders`, which left the toolbar's own strings out of it.
    const blockNoteDictionary = useBlockNoteDictionary();
    const dictionary = {
        ...blockNoteDictionary,
        placeholders: {
            ...blockNoteDictionary.placeholders,
            emptyDocument: placeholder,
            default: "",
            heading: "",
        },
    };
    const composer = useChatComposer<Message | null>({
        schema,
        dictionary,
        draftKey: draftKeyFor(channelId, parentId),
        // The Send button reads `editor.document` at render time (it never had state).
        isSendable: (blocks) => hasSendableContent(blocks) || hasAttachments,
        clear: "after",
        // Send the current document. `busy` disables the Send and attach buttons while this
        // runs; it does NOT stop a second Cmd+Enter (the text stays until the ack), so a fast
        // double chord sends twice. Kept as it was; see MIP-1161.
        submit: async (blocks) => {
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
                return msg ?? null;
            } catch (e) {
                const err = e as ChannelServiceError;
                onError?.(`${err.code ?? "ERROR"}: ${err.message ?? String(e)}`);
                return false;
            }
        },
        // After the clear. Pending strip is only reset when there are no remaining errors —
        // failed uploads stay visible so the user can retry without re-picking the files.
        onSent: (msg) => {
            if (!hasAttachments || attachments.pending.length === 0) {
                attachments.reset();
            }
            if (msg) onSendComplete?.(msg.id);
        },
    });
    const { editor, busy } = composer;

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
            return filterAndRankSuggestionItems(items, query);
        },
        [editor, members]
    );

    return (
        <>
            <PendingAttachmentStrip
                pending={attachments.pending}
                testIdPrefix={testIdPrefix}
                onRemove={attachments.removeAt}
            />
            <div
                data-fab-avoid="composer"
                data-testid={testIdPrefix}
                style={{
                    display: "flex",
                    alignItems: "stretch",
                    gap: 8,
                    padding: "8px 12px",
                    borderTop: "1px solid #ddd",
                    background: "#fff",
                }}
            >
                <input
                    ref={fileInputRef}
                    data-testid={`${testIdPrefix}-file-input`}
                    style={{ display: "none" }}
                    type="file"
                    multiple
                    onChange={(e) => {
                        attachments.addFiles(e.target.files);
                        // Reset the input so re-picking the same file
                        // after a remove still fires onChange.
                        e.target.value = "";
                    }}
                />
                <AppTooltip title={t.chat.channel.composer.attachFiles}>
                    <button
                        data-testid={`${testIdPrefix}-attach`}
                        disabled={busy}
                        type="button"
                        style={{
                            alignSelf: "flex-end",
                            marginBottom: 4,
                            fontSize: 16,
                            padding: "4px 8px",
                        }}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        📎
                    </button>
                </AppTooltip>
                <div
                    data-testid={`${testIdPrefix}-editor-host`}
                    style={{ flex: 1, minWidth: 0 }}
                    onKeyDown={(e) => {
                        if (isSendShortcut(e)) {
                            e.preventDefault();
                            e.stopPropagation();
                            void composer.send();
                        }
                    }}
                >
                    <BlockNoteView
                        editor={editor}
                        emojiPicker={false}
                        formattingToolbar={true}
                        sideMenu={false}
                        slashMenu={true}
                        onChange={composer.viewProps.onChange}
                    >
                        <HashSuggestionMenuController editor={editor} />
                        <SuggestionMenuController
                            getItems={getMentionItems}
                            triggerCharacter="@"
                        />
                    </BlockNoteView>
                </div>
                <button
                    data-testid={`${testIdPrefix}-send`}
                    style={{ alignSelf: "flex-end", marginBottom: 4 }}
                    type="button"
                    disabled={
                        busy || attachments.isUploading || (!composer.canSend && !hasAttachments)
                    }
                    onClick={() => void composer.send()}
                >
                    {attachments.isUploading ? "Uploading…" : "Send"}
                </button>
            </div>
        </>
    );
}
