import { ReactNode, useState } from "react";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";

import { useTranslation } from "../../../i18n";
import { ForceDeleteError } from "../../../services/forceDelete";
import { g } from "../../../theme/tokens";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = {
    open: boolean;
    /** What is being deleted, in the dialog title: "this task", "this message". */
    title: string;
    /** What goes, and that it cannot come back. */
    description: ReactNode;
    /** The thing acted on (a task's title), shown under the description. */
    entityName?: string;
    /** The exact text to type. Defaults to the localized word. */
    confirmPhrase?: string;
    /** Runs the delete. A rejection keeps the dialog open and shows why. */
    onConfirm: () => Promise<unknown>;
    onClose: () => void;
    zIndex?: number;
    hostZIndex?: number;
};

/**
 * "Delete permanently" (MIP-1584): the one confirmation every force delete uses. A typed phrase
 * enables the red button, there is NO Undo (the data is really gone), and a refusal from the server
 * is shown in the dialog (`403` "not yours to delete", `409` "has sub-tasks", ...).
 */
export const ForceDeleteDialog = ({
    open,
    title,
    description,
    entityName,
    confirmPhrase,
    onConfirm,
    onClose,
    zIndex,
    hostZIndex,
}: Props) => {
    const { t } = useTranslation();
    const copy = t.common.forceDelete;
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        setError(null);
        try {
            await onConfirm();
        } catch (e) {
            const message =
                e instanceof ForceDeleteError
                    ? e.status === 403
                        ? copy.notAllowed
                        : e.code === "has_subtasks"
                          ? copy.hasSubtasks
                          : e.code === "milestone"
                            ? copy.isMilestone
                            : e.code === "task_linked"
                              ? copy.taskLinked
                              : copy.failed
                    : copy.failed;
            setError(message);
            throw new Error(message);
        }
    };

    return (
        <ConfirmDialog
            cancelLabel={copy.cancel}
            confirmLabel={copy.confirm}
            confirmPhrase={confirmPhrase ?? copy.phrase}
            confirmPhraseLabel={copy.typeLabel}
            description={description}
            entityName={entityName}
            error={error}
            hostZIndex={hostZIndex}
            icon={<DeleteForeverRoundedIcon sx={{ color: g.danger.text }} />}
            open={open}
            title={title}
            zIndex={zIndex}
            closeOnConfirm
            destructive
            onConfirm={run}
            onClose={() => {
                setError(null);
                onClose();
            }}
        />
    );
};
