import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";

import { useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { ConfirmDialog } from "../modal/ConfirmDialog";

type Props = {
    open: boolean;
    title: string;
    description: string;
    entityName: string;
    /** Called when the user clicks Leave. Should return `true` on success
     *  so the modal can close cleanly; `false` (or thrown) leaves the
     *  error message displayed. */
    onConfirm: () => Promise<boolean>;
    onCancel: () => void;
    /** Overrides the "Leave" verb. This dialog is the house style for
     *  "confirm something irreversible about a relationship", and
     *  cross-team disconnect reuses it — but a button reading "Leave"
     *  when the act is "Disconnect" names the wrong thing. */
    confirmLabel?: string;
};

export const ModalLeaveConfirm = ({
    open,
    title,
    description,
    entityName,
    onConfirm,
    onCancel,
    confirmLabel,
}: Props) => {
    const { t } = useTranslation();

    // role stays a plain "dialog": callers and tests look for it.
    return (
        <ConfirmDialog
            cancelLabel={t.common.leaveConfirm.cancel}
            confirmLabel={confirmLabel ?? t.common.leaveConfirm.leave}
            description={description}
            entityName={entityName}
            icon={<LogoutRoundedIcon sx={{ color: g.danger.text }} />}
            open={open}
            role="dialog"
            title={title}
            destructive
            onClose={onCancel}
            onConfirm={async () => {
                // `false` means the caller already knows it failed.
                if (!(await onConfirm())) throw new Error(t.common.leaveConfirm.genericError);
            }}
        />
    );
};
