/**
 * `ThreadPanelV3` — side panel that renders one thread.
 *
 * Consumed by `V3ChatShell` when the route includes a `:rootMessageId`.
 * Reads the root + replies via `useChannelThread` (which subscribes to
 * the same `channelService` store as the main pane), exposes a
 * composer that sends replies with `parentId === rootMessageId`.
 *
 * Intentionally not styled to match the production thread surface yet —
 * proof-of-life only.
 */

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Box, Button, IconButton, Input, Sheet, Stack, Typography } from "@mui/joy";

import { channelService, ChannelServiceError } from "../../../services/channel/channelService";
import { purplePalette } from "../../../theme/purplePalette";
import { useAttachmentDraft } from "../hooks/useAttachmentDraft";
import { useChannelThread } from "../hooks/useChannelThread";
import { candidatesFromMessages, useMentionDraft } from "../hooks/useMentionDraft";
import { MessageAttachments } from "./MessageAttachments";
import { MessageBody } from "./MessageBody";
import { PendingAttachmentStrip } from "./PendingAttachmentStrip";

/** Pinned to dark palette — see ChannelListV3.tsx for the rationale. */
const p = purplePalette.dark;

interface ThreadPanelV3Props {
    channelId: string;
    rootMessageId: string;
    onClose: () => void;
}

export function ThreadPanelV3({ channelId, rootMessageId, onClose }: ThreadPanelV3Props) {
    const { root, replies, replyInThread, isLoading } = useChannelThread(channelId, rootMessageId);
    const currentUserId = typeof window === "undefined" ? null : localStorage.getItem("userId");
    // Picker candidates come from the people we've already seen in this
    // thread — root + replies. That keeps the mention scope tight to
    // the thread participants, not the whole channel.
    const candidates = useMemo(
        () => candidatesFromMessages(root ? [root, ...replies] : replies, currentUserId),
        [root, replies, currentUserId]
    );
    const mention = useMentionDraft(candidates);
    const attachments = useAttachmentDraft();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const snapshot = useSyncExternalStore(
        channelService.subscribe,
        channelService.getSnapshot,
        channelService.getSnapshot
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function toggleFlag(messageId: string, isFlagged: boolean) {
        try {
            if (isFlagged) await channelService.unflagMessage(messageId);
            else await channelService.flagMessage(messageId);
        } catch (e) {
            const err = e as ChannelServiceError;
            setError(`${err.code ?? "INTERNAL"}: ${err.message ?? String(err)}`);
        }
    }

    async function send() {
        const text = mention.draft.trim();
        const hasAttachments = attachments.pending.some((p) => p.error === null);
        if (!text && !hasAttachments) return;
        setBusy(true);
        setError(null);
        try {
            const reply = await replyInThread(mention.buildBody(), { bodyText: text });
            if (reply && hasAttachments) {
                const report = await attachments.uploadAll(channelId, reply.id);
                if (report.failed.length > 0) {
                    setError(
                        `Uploaded ${report.succeeded}, ${report.failed.length} failed: ` +
                            report.failed.map((f) => f.error).join("; ")
                    );
                }
            }
            mention.reset();
            if (!hasAttachments || attachments.pending.length === 0) {
                attachments.reset();
            }
        } catch (e) {
            const err = e as ChannelServiceError;
            setError(`${err.code ?? "INTERNAL"}: ${err.message ?? String(err)}`);
        } finally {
            setBusy(false);
        }
    }

    const flagBtn = (id: string) => ({
        ml: 0.75,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: 12,
        opacity: snapshot.flagByMessageId.has(id) ? 1 : 0.45,
        color: p.textMuted,
        "&:hover": { color: p.text },
    });

    return (
        <Sheet
            data-testid="thread-panel-v3"
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                background: p.bg,
                color: p.text,
            }}
        >
            <Box
                component="header"
                sx={{
                    px: 1.5,
                    py: 1,
                    borderBottom: `1px solid ${p.divider}`,
                    background: p.surfaceElevated,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <Typography level="title-sm" sx={{ color: p.text, fontWeight: 700 }}>
                    Thread
                </Typography>
                <Button
                    size="sm"
                    variant="plain"
                    onClick={onClose}
                    data-testid="thread-panel-v3-close"
                    sx={{ color: p.textMuted, "&:hover": { color: p.text } }}
                >
                    Close
                </Button>
            </Box>

            <Box
                data-testid="thread-panel-v3-body"
                sx={{
                    flex: 1,
                    overflowY: "auto",
                    px: 1.5,
                    py: 1,
                }}
            >
                {isLoading && <Box sx={{ color: p.textSubtle }}>Loading thread…</Box>}
                {!isLoading && root && (
                    <>
                        <Box
                            data-testid="thread-panel-v3-root"
                            sx={{
                                pb: 1,
                                mb: 1,
                                borderBottom: `1px solid ${p.divider}`,
                            }}
                        >
                            <Typography
                                component="strong"
                                level="title-sm"
                                sx={{ color: p.accentSoft, fontWeight: 700 }}
                            >
                                {root.sender?.userName ?? "system"}:
                            </Typography>{" "}
                            {root.deletedAt ? (
                                "(deleted)"
                            ) : (
                                <MessageBody
                                    body={root.body}
                                    bodyText={root.bodyText}
                                    currentUserId={currentUserId}
                                />
                            )}
                            {!root.deletedAt && (
                                <Box
                                    component="button"
                                    type="button"
                                    onClick={() =>
                                        void toggleFlag(
                                            root.id,
                                            snapshot.flagByMessageId.has(root.id)
                                        )
                                    }
                                    data-testid={`thread-panel-v3-flag-${root.id}`}
                                    title={
                                        snapshot.flagByMessageId.has(root.id) ? "Unflag" : "Flag"
                                    }
                                    sx={flagBtn(root.id)}
                                >
                                    ⭐
                                </Box>
                            )}
                            {!root.deletedAt && root.attachments.length > 0 && (
                                <MessageAttachments
                                    messageId={root.id}
                                    attachments={root.attachments}
                                />
                            )}
                        </Box>
                        <Box
                            component="ul"
                            data-testid="thread-panel-v3-replies"
                            sx={{ listStyle: "none", m: 0, p: 0 }}
                        >
                            {replies.map((r) => (
                                <Box
                                    component="li"
                                    key={r.id}
                                    data-testid={`thread-panel-v3-reply-${r.id}`}
                                    sx={{
                                        py: 0.5,
                                        opacity: r.deletedAt ? 0.4 : 1,
                                        borderRadius: 4,
                                        px: 0.5,
                                        "&:hover": { background: p.hoverBg },
                                    }}
                                >
                                    <Typography
                                        component="strong"
                                        level="title-sm"
                                        sx={{ color: p.accentSoft, fontWeight: 700 }}
                                    >
                                        {r.sender?.userName ?? "system"}:
                                    </Typography>{" "}
                                    {r.deletedAt ? (
                                        "(deleted)"
                                    ) : (
                                        <MessageBody
                                            body={r.body}
                                            bodyText={r.bodyText}
                                            currentUserId={currentUserId}
                                        />
                                    )}
                                    {r.editedAt && !r.deletedAt && (
                                        <Typography
                                            component="span"
                                            level="body-xs"
                                            sx={{ ml: 1, color: p.textSubtle }}
                                        >
                                            (edited)
                                        </Typography>
                                    )}
                                    {!r.deletedAt && (
                                        <Box
                                            component="button"
                                            type="button"
                                            onClick={() =>
                                                void toggleFlag(
                                                    r.id,
                                                    snapshot.flagByMessageId.has(r.id)
                                                )
                                            }
                                            data-testid={`thread-panel-v3-flag-${r.id}`}
                                            title={
                                                snapshot.flagByMessageId.has(r.id)
                                                    ? "Unflag"
                                                    : "Flag"
                                            }
                                            sx={flagBtn(r.id)}
                                        >
                                            ⭐
                                        </Box>
                                    )}
                                    {!r.deletedAt && r.attachments.length > 0 && (
                                        <MessageAttachments
                                            messageId={r.id}
                                            attachments={r.attachments}
                                        />
                                    )}
                                </Box>
                            ))}
                            {replies.length === 0 && (
                                <Box component="li" sx={{ color: p.textSubtle }}>
                                    No replies yet.
                                </Box>
                            )}
                        </Box>
                    </>
                )}
                {!isLoading && !root && (
                    <Box sx={{ color: p.textSubtle }}>Thread root not loaded.</Box>
                )}
            </Box>

            {error && (
                <Box
                    role="alert"
                    onClick={() => setError(null)}
                    sx={{
                        color: p.dangerTint,
                        background: p.dangerTintBg,
                        border: `1px solid ${p.dangerTintBorder}`,
                        borderRadius: 6,
                        mx: 1.5,
                        my: 0.5,
                        px: 1,
                        py: 0.5,
                        fontSize: 12,
                        cursor: "pointer",
                    }}
                >
                    {error} (click to dismiss)
                </Box>
            )}

            <PendingAttachmentStrip
                pending={attachments.pending}
                onRemove={attachments.removeAt}
                testIdPrefix="thread-panel-v3"
            />
            <Box
                component="form"
                onSubmit={(e: React.FormEvent) => {
                    e.preventDefault();
                    void send();
                }}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    borderTop: `1px solid ${p.divider}`,
                    background: p.surface,
                    position: "relative",
                }}
            >
                {mention.pickerOpen && (
                    <Sheet
                        variant="outlined"
                        data-testid="thread-panel-v3-mention-picker"
                        sx={{
                            position: "absolute",
                            bottom: "100%",
                            left: 12,
                            mb: 0.5,
                            background: p.surfaceSolid,
                            borderColor: p.border,
                            color: p.text,
                            borderRadius: 6,
                            boxShadow: p.shadow,
                            fontSize: 13,
                            minWidth: 180,
                            zIndex: 10,
                            overflow: "hidden",
                        }}
                    >
                        {mention.suggestions.map((s) => (
                            <Box
                                key={s.userId}
                                component="button"
                                type="button"
                                onMouseDown={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    mention.selectCandidate(s);
                                }}
                                data-testid={`thread-panel-v3-mention-option-${s.userId}`}
                                sx={{
                                    display: "block",
                                    width: "100%",
                                    textAlign: "left",
                                    px: 1,
                                    py: 0.75,
                                    background: "transparent",
                                    border: "none",
                                    color: p.text,
                                    cursor: "pointer",
                                    "&:hover": { background: p.hoverBg },
                                }}
                            >
                                @{s.userName}
                            </Box>
                        ))}
                    </Sheet>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => {
                        attachments.addFiles(e.target.files);
                        e.target.value = "";
                    }}
                    style={{ display: "none" }}
                    data-testid="thread-panel-v3-file-input"
                />
                <IconButton
                    size="sm"
                    variant="plain"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || !root}
                    title="Attach file(s)"
                    data-testid="thread-panel-v3-attach"
                    sx={{
                        fontSize: 16,
                        color: p.textMuted,
                        "&:hover": { background: p.hoverBg, color: p.text },
                    }}
                >
                    📎
                </IconButton>
                <Input
                    slotProps={{
                        input: {
                            "data-testid": "thread-panel-v3-input",
                            value: mention.draft,
                            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                                mention.setDraft(e.target.value);
                                mention.setCaret(e.target.selectionStart ?? e.target.value.length);
                            },
                            onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) =>
                                mention.setCaret(
                                    e.currentTarget.selectionStart ?? e.currentTarget.value.length
                                ),
                            onClick: (e: React.MouseEvent<HTMLInputElement>) =>
                                mention.setCaret(
                                    e.currentTarget.selectionStart ?? e.currentTarget.value.length
                                ),
                        },
                    }}
                    placeholder="Reply…  (type @ to mention)"
                    disabled={busy || !root}
                    sx={{
                        flex: 1,
                        background: p.inputBg,
                        borderColor: p.inputBorder,
                        color: p.text,
                        "&:focus-within": {
                            borderColor: p.inputFocusBorder,
                            boxShadow: p.inputFocusShadow,
                        },
                    }}
                />
                <Button
                    type="submit"
                    size="sm"
                    disabled={
                        busy ||
                        !root ||
                        attachments.isUploading ||
                        (!mention.draft.trim() &&
                            !attachments.pending.some((q) => q.error === null))
                    }
                    data-testid="thread-panel-v3-send"
                    sx={{
                        background: p.primaryButtonBg,
                        color: "#fff",
                        boxShadow: p.primaryButtonShadow,
                        "&:hover": { background: p.primaryButtonHover },
                        "&:disabled": { opacity: 0.5 },
                    }}
                >
                    {attachments.isUploading ? "Uploading…" : "Reply"}
                </Button>
            </Box>
        </Sheet>
    );
}
