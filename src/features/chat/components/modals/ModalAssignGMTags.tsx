import { useEffect, useState } from "react";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import { Alert, Box, Button, Checkbox, Typography } from "@mui/joy";

import { Clickable } from "../../../../components/ui/Clickable";
import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { usePersonalGMTags } from "../../../../hooks/common/usePersonalGMTags";
import { fmt, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { AllChatProps } from "../../../../types/chat";
import { GMTagCreateRow } from "./ModalManageGMTags";

/**
 * Per-chat tag assignment: a checkbox list of the user's personal tags
 * plus an inline create row, saved as one replace-set PUT
 * (`setChannelTags`). Opened from the GM row's ⋮ menu.
 *
 * The draft selection is local state seeded from the store each time
 * the modal opens, so an abandoned edit never leaks and a save is a
 * single idempotent write.
 */

const MAX_TAGS_PER_CHANNEL = 20;

type ModalAssignGMTagsProps = {
    chat: AllChatProps;
    open: boolean;
    setOpen: (value: boolean) => void;
};

export const ModalAssignGMTags = ({ chat, open, setOpen }: ModalAssignGMTagsProps) => {
    const { t } = useTranslation();
    const { tags, assignmentsByChannelId, setChannelTags } = usePersonalGMTags();

    const [draftIds, setDraftIds] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Re-seed the draft from the live assignment each time the modal
    // opens (and drop ids of tags deleted meanwhile).
    useEffect(() => {
        if (!open) return;
        const live = new Set(tags.map((tg) => tg.tagId));
        setDraftIds((assignmentsByChannelId[chat.chatId] ?? []).filter((id) => live.has(id)));
        setError(null);
        // Deliberately NOT re-seeding on assignment changes while open —
        // the draft is the user's in-progress edit.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, chat.chatId]);

    const toggle = (tagId: number) => {
        setError(null);
        setDraftIds((prev) =>
            prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
        );
    };

    const handleSave = async () => {
        if (draftIds.length > MAX_TAGS_PER_CHANNEL) {
            setError(t.chat.gmTags.maxPerChatReached);
            return;
        }
        setBusy(true);
        const ok = await setChannelTags(chat.chatId, draftIds);
        setBusy(false);
        if (!ok) {
            setError(t.chat.gmTags.saveFailed);
            return;
        }
        setOpen(false);
    };

    return (
        <ModalFrame
            description={t.chat.gmTags.privateHint}
            icon={<SellOutlinedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="sm"
            title={fmt(t.chat.gmTags.assignTitle, { name: chat.chatName || "" })}
            zIndex={10010}
            actions={
                <>
                    <Button color="neutral" variant="plain" onClick={() => setOpen(false)}>
                        {t.chat.gmTags.cancelButton}
                    </Button>
                    <Button disabled={busy} onClick={() => void handleSave()}>
                        {t.chat.gmTags.saveButton}
                    </Button>
                </>
            }
            onClose={() => setOpen(false)}
        >
            <Box sx={{ maxHeight: 260, my: 1, overflowY: "auto" }}>
                {tags.length === 0 && (
                    <EmptyState
                        body={t.chat.gmTags.emptyAssign}
                        data-empty="gm-tags-assign"
                        size="sm"
                    />
                )}
                {tags.map((tag) => (
                    <Clickable
                        key={tag.tagId}
                        aria-checked={draftIds.includes(tag.tagId)}
                        role="checkbox"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            flexDirection: "row",
                            gap: 1,
                            "&:hover": { background: g.hover },
                            borderRadius: g.radius.md,
                            cursor: "pointer",
                            px: 0.75,
                            py: 0.6,
                        }}
                        onActivate={() => toggle(tag.tagId)}
                    >
                        <Checkbox
                            checked={draftIds.includes(tag.tagId)}
                            size="sm"
                            sx={{ pointerEvents: "none" }}
                        />
                        <Box
                            sx={{
                                background: tag.color,
                                borderRadius: "50%",
                                flexShrink: 0,
                                height: 12,
                                width: 12,
                            }}
                        />
                        <Typography level="body-sm" sx={{ flex: 1 }} noWrap>
                            {tag.name}
                        </Typography>
                    </Clickable>
                ))}
            </Box>

            {/* Create-and-check: a tag made here is immediately part
                    of the draft selection. */}
            <GMTagCreateRow onCreated={(tag) => setDraftIds((prev) => [...prev, tag.tagId])} />

            {error && (
                <Alert color="warning" size="sm" sx={{ mt: 1 }}>
                    {error}
                </Alert>
            )}
        </ModalFrame>
    );
};
