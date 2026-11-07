import { ReactNode } from "react";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";

import { g } from "../../../theme/tokens";
import { ConfirmDialog } from "../modal/ConfirmDialog";

type Props = {
    open: boolean;
    title: string;
    description: string;
    /** The thing being acted on (a task's title, say), shown under the title. */
    entityName?: string;
    confirmLabel: string;
    cancelLabel: string;
    /** Defaults to the swap arrows, which suit "turn this into that". */
    icon?: ReactNode;
    /**
     * "danger" is the red of the other delete / leave dialogs, for an action
     * that destroys something. The default purple is for the rest.
     */
    tone?: "brand" | "danger";
    /**
     * Stacking layer. 10010 is where the other confirmation dialogs sit,
     * which is BELOW a modal-hosted preview (10020 and up), so a preview
     * that opens this passes a layer above its own.
     */
    zIndex?: number;
    /**
     * Runs on Confirm. The dialog closes once it resolves; if it throws, the
     * dialog stays open and shows the error, so the person can retry or cancel.
     */
    onConfirm: () => Promise<unknown> | unknown;
    onClose: () => void;
};

/**
 * Confirm an action in the app's own dialog (MIP-1042 follow-up), not the
 * browser's `confirm()`.
 *
 * A thin shape over the shared `ConfirmDialog` (MIP-1125): "brand" is the
 * primary-button version for an action where nothing is lost; "danger" is the
 * red one. Confirm runs the action and then closes; if it throws, the dialog
 * stays open with the message.
 */
export const ModalConfirmAction = ({
    open,
    title,
    description,
    entityName,
    confirmLabel,
    cancelLabel,
    icon,
    tone = "brand",
    zIndex = 10010,
    onConfirm,
    onClose,
}: Props) => {
    const danger = tone === "danger";
    return (
        <ConfirmDialog
            cancelLabel={cancelLabel}
            confirmLabel={confirmLabel}
            description={description}
            destructive={danger}
            entityName={entityName}
            open={open}
            role="dialog"
            title={title}
            tone={tone}
            zIndex={zIndex}
            icon={
                icon ?? (
                    <SwapHorizRoundedIcon sx={{ color: danger ? g.danger.text : g.accent.text }} />
                )
            }
            closeOnConfirm
            onClose={onClose}
            onConfirm={onConfirm}
        />
    );
};
