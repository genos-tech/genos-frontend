import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../../i18n";

type ModalDeleteFolderProps = {
    open: boolean;
    folderName: string;
    onClose: () => void;
    onConfirm: () => void;
};

// Confirm dialog for folder deletion. Deleting is non-destructive for
// contents — the copy states that notes/subfolders move up one level.
export const ModalDeleteFolder = (props: ModalDeleteFolderProps) => {
    const { open, folderName, onClose, onConfirm } = props;
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

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
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                    <DeleteOutlineRoundedIcon
                        sx={{ fontSize: 20, color: isDark ? "#f87171" : "#dc2626" }}
                    />
                    <Typography level="title-lg">
                        {t.notes.folders.deleteFolderTitle}
                    </Typography>
                </Stack>

                <Typography level="title-sm" sx={{ mb: 0.5 }} noWrap>
                    {folderName}
                </Typography>
                <Typography level="body-sm" sx={{ opacity: 0.75 }}>
                    {t.notes.folders.deleteFolderWarning}
                </Typography>

                <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
                    <Button color="neutral" variant="plain" onClick={onClose}>
                        {t.notes.folders.cancel}
                    </Button>
                    <Button
                        color="danger"
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {t.notes.folders.delete}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
