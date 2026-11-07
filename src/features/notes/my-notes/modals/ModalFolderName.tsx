import { useEffect, useState } from "react";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import { Button, Input } from "@mui/joy";

import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";

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
        <ModalFrame
            icon={<FolderRoundedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="sm"
            title={mode === "create" ? t.notes.folders.createTitle : t.notes.folders.renameTitle}
            actions={
                <>
                    <Button color="neutral" variant="plain" onClick={onClose}>
                        {t.notes.folders.cancel}
                    </Button>
                    <Button disabled={!canSubmit} onClick={submit}>
                        {mode === "create" ? t.notes.folders.create : t.notes.folders.save}
                    </Button>
                </>
            }
            onClose={onClose}
        >
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
        </ModalFrame>
    );
};
