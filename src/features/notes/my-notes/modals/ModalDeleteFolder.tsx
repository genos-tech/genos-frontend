import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";

type ModalDeleteFolderProps = {
    open: boolean;
    folderName: string;
    onClose: () => void;
    onConfirm: () => void;
};

// Confirm dialog for folder deletion. DESTRUCTIVE (product spec): the
// folder and everything inside — subfolders, filed notes, and their
// child notes — are permanently deleted; the copy warns accordingly.
export const ModalDeleteFolder = (props: ModalDeleteFolderProps) => {
    const { open, folderName, onClose, onConfirm } = props;
    const { t } = useTranslation();

    return (
        <ConfirmDialog
            cancelLabel={t.notes.folders.cancel}
            confirmLabel={t.notes.folders.delete}
            description={t.notes.folders.deleteFolderWarning}
            entityName={folderName}
            icon={<DeleteOutlineRoundedIcon sx={{ color: g.danger.text }} />}
            open={open}
            title={t.notes.folders.deleteFolderTitle}
            closeOnConfirm
            destructive
            onClose={onClose}
            onConfirm={() => {
                onConfirm();
            }}
        />
    );
};
