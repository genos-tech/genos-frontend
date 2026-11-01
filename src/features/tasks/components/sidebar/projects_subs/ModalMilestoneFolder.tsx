import { useEffect, useState } from "react";
import {
    Alert,
    Button,
    DialogActions,
    DialogContent,
    DialogTitle,
    Input,
    Modal,
    ModalDialog,
    Typography,
} from "@mui/joy";

import { fmt, useTranslation } from "../../../../../i18n";

export type MilestoneFolderModalState =
    | { mode: "create" }
    | { mode: "rename"; folderId: number; name: string }
    | { mode: "delete"; folderId: number; name: string };

type Props = {
    state: MilestoneFolderModalState | null;
    onClose: () => void;
    /** Resolves true when the server accepted the name. */
    onCreate: (name: string) => Promise<boolean>;
    onRename: (folderId: number, name: string) => Promise<boolean>;
    onDelete: (folderId: number) => Promise<boolean>;
};

// Matches `MilestoneFolder.name` (max_length=100) on the server.
const MAX_NAME_LENGTH = 100;

/**
 * One small dialog for the three folder actions of the milestone sidebar
 * (MIP-847): create, rename, and delete-with-confirm. Any project member
 * can open it; the server enforces membership. Deleting says plainly that
 * the milestones inside are kept.
 */
export const ModalMilestoneFolder = ({ state, onClose, onCreate, onRename, onDelete }: Props) => {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Re-seed whenever a different action opens, so a rename starts from the
    // folder's current name and a create starts empty.
    useEffect(() => {
        setName(state?.mode === "rename" ? state.name : "");
        setError(null);
        setBusy(false);
    }, [state]);

    if (!state) return null;

    const trimmed = name.trim();
    const canSubmit = state.mode === "delete" || (trimmed.length > 0 && !busy);

    const submit = async () => {
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        let ok = false;
        if (state.mode === "create") ok = await onCreate(trimmed);
        else if (state.mode === "rename") ok = await onRename(state.folderId, trimmed);
        else ok = await onDelete(state.folderId);
        setBusy(false);
        if (ok) onClose();
        else
            setError(
                state.mode === "delete" ? t.tasks.folders.saveFailed : t.tasks.folders.nameTaken
            );
    };

    const title =
        state.mode === "create"
            ? t.tasks.folders.createTitle
            : state.mode === "rename"
              ? t.tasks.folders.renameTitle
              : t.tasks.folders.deleteTitle;

    return (
        <Modal sx={{ zIndex: 10010 }} open onClose={onClose}>
            <ModalDialog sx={{ borderRadius: "16px", maxWidth: 380, width: "92%" }}>
                <DialogTitle>{title}</DialogTitle>
                <DialogContent>
                    {state.mode === "delete" ? (
                        <Typography level="body-sm">
                            {fmt(t.tasks.folders.deleteBody, { name: state.name })}
                        </Typography>
                    ) : (
                        <Input
                            placeholder={t.tasks.folders.namePlaceholder}
                            slotProps={{ input: { maxLength: MAX_NAME_LENGTH } }}
                            value={name}
                            autoFocus
                            onChange={(e) => {
                                setName(e.target.value);
                                setError(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    void submit();
                                }
                            }}
                        />
                    )}
                    {error && (
                        <Alert color="warning" size="sm" sx={{ mt: 1 }}>
                            {error}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        color={state.mode === "delete" ? "danger" : "primary"}
                        disabled={!canSubmit}
                        loading={busy}
                        onClick={() => void submit()}
                    >
                        {state.mode === "create"
                            ? t.tasks.folders.create
                            : state.mode === "rename"
                              ? t.tasks.folders.save
                              : t.tasks.folders.delete}
                    </Button>
                    <Button color="neutral" variant="plain" onClick={onClose}>
                        {t.tasks.folders.cancel}
                    </Button>
                </DialogActions>
            </ModalDialog>
        </Modal>
    );
};
