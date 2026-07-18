import { useEffect, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    IconButton,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { usePersonalGMTags } from "../../../../hooks/common/usePersonalGMTags";
import { fmt, useTranslation } from "../../../../i18n";
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
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
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
        <Modal open={open} sx={{ zIndex: 10010 }} onClose={() => setOpen(false)}>
            <ModalDialog
                sx={{
                    borderRadius: "16px",
                    maxWidth: 400,
                    p: 2.5,
                    width: "92%",
                }}
            >
                <Stack alignItems="center" direction="row" justifyContent="space-between">
                    <Stack alignItems="center" direction="row" spacing={1} sx={{ minWidth: 0 }}>
                        <SellOutlinedIcon
                            sx={{ color: isDark ? "#a78bfa" : "#7c3aed", fontSize: 20 }}
                        />
                        <Typography level="title-md" sx={{ fontWeight: 700 }} noWrap>
                            {fmt(t.chat.gmTags.assignTitle, { name: chat.chatName || "" })}
                        </Typography>
                    </Stack>
                    <IconButton size="sm" variant="plain" onClick={() => setOpen(false)}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>

                <Typography
                    level="body-xs"
                    sx={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}
                >
                    {t.chat.gmTags.privateHint}
                </Typography>

                <Box
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    sx={{ maxHeight: 260, my: 1, overflowY: "auto" }}
                >
                    {tags.length === 0 && (
                        <Typography
                            level="body-sm"
                            sx={{
                                color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                                py: 1.5,
                                textAlign: "center",
                            }}
                        >
                            {t.chat.gmTags.emptyAssign}
                        </Typography>
                    )}
                    {tags.map((tag) => (
                        <Stack
                            key={tag.tagId}
                            alignItems="center"
                            direction="row"
                            spacing={1}
                            sx={{
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(255,255,255,0.04)"
                                        : "rgba(0,0,0,0.03)",
                                },
                                borderRadius: "8px",
                                cursor: "pointer",
                                px: 0.75,
                                py: 0.6,
                            }}
                            onClick={() => toggle(tag.tagId)}
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
                        </Stack>
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

                <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
                    <Button size="sm" variant="plain" onClick={() => setOpen(false)}>
                        {t.chat.gmTags.cancelButton}
                    </Button>
                    <Button disabled={busy} size="sm" onClick={() => void handleSave()}>
                        {t.chat.gmTags.saveButton}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
