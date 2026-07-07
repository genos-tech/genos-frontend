import { useEffect, useState } from "react";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import { Box, Button, Input, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../../i18n";

type ModalFolderNameProps = {
    open: boolean;
    /** "create" shows the create title/CTA; "rename" the rename ones. */
    mode: "create" | "rename";
    /** Seed value — the current name when renaming. */
    initialName?: string;
    onClose: () => void;
    /** Called with the trimmed, non-empty name. */
    onSubmit: (name: string) => void;
};

// Dual-purpose "New folder" / "Rename folder" dialog: a single name
// input, Enter submits, Escape/backdrop closes.
export const ModalFolderName = (props: ModalFolderNameProps) => {
    const { open, mode, initialName = "", onClose, onSubmit } = props;
    const { t } = useTranslation();
    const { mode: colorMode } = useColorScheme();
    const isDark = colorMode === "dark";

    const [name, setName] = useState(initialName);

    // Re-seed when the dialog opens for a different target.
    useEffect(() => {
        if (open) setName(initialName);
    }, [open, initialName]);

    const trimmed = name.trim();
    const canSubmit = trimmed.length > 0 && trimmed.length <= 255;

    const submit = () => {
        if (!canSubmit) return;
        onSubmit(trimmed);
        onClose();
    };

    return (
        <Modal
            open={open}
            sx={{ zIndex: 10010, backdropFilter: "blur(4px)" }}
            onClose={onClose}
        >
            <ModalDialog
                sx={{
                    borderRadius: "16px",
                    width: { xs: "calc(100vw - 24px)", md: "380px" },
                    p: { xs: 2, md: 3 },
                }}
            >
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1.5 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 34,
                            height: 34,
                            borderRadius: "10px",
                            background: isDark
                                ? "rgba(124,58,237,0.2)"
                                : "rgba(124,58,237,0.1)",
                        }}
                    >
                        <FolderRoundedIcon
                            sx={{ fontSize: 18, color: isDark ? "#a78bfa" : "#7c3aed" }}
                        />
                    </Box>
                    <Typography level="title-lg">
                        {mode === "create"
                            ? t.notes.folders.createTitle
                            : t.notes.folders.renameTitle}
                    </Typography>
                </Stack>

                <Input
                    placeholder={t.notes.folders.folderNamePlaceholder}
                    size="md"
                    value={name}
                    autoFocus
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            submit();
                        }
                    }}
                />

                <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
                    <Button color="neutral" variant="plain" onClick={onClose}>
                        {t.notes.folders.cancel}
                    </Button>
                    <Button disabled={!canSubmit} onClick={submit}>
                        {mode === "create" ? t.notes.folders.create : t.notes.folders.save}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
