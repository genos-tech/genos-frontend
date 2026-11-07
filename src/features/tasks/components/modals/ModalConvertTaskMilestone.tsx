import { ModalConfirmAction } from "../../../../components/ui/misc/ModalConfirmAction";
import { useTranslation } from "../../../../i18n";

type Props = {
    /** Which way: a root task becoming a milestone, or a milestone becoming a task. */
    direction: "toMilestone" | "toTask";
    open: boolean;
    /** The title of the task or milestone being converted. */
    name?: string;
    /** Layer to sit at; pass one above a modal-hosted preview's own. */
    zIndex?: number;
    onConfirm: () => Promise<unknown> | unknown;
    onClose: () => void;
};

/**
 * "Convert this … to a …?" before a task/milestone conversion (MIP-1042).
 * Says what happens to the tasks under it, because that is the part nobody
 * can see from the menu.
 */
export const ModalConvertTaskMilestone = ({
    direction,
    open,
    name,
    zIndex,
    onConfirm,
    onClose,
}: Props) => {
    const { t } = useTranslation();
    const words =
        direction === "toMilestone"
            ? {
                  title: t.tasks.titleBlock.menu.convertToMilestoneTitle,
                  description: t.tasks.titleBlock.menu.convertToMilestoneBody,
                  confirmLabel: t.tasks.titleBlock.menu.convertToMilestone,
              }
            : {
                  title: t.tasks.preview.menu.convertToTaskTitle,
                  description: t.tasks.preview.menu.convertToTaskBody,
                  confirmLabel: t.tasks.preview.menu.convertToTask,
              };
    return (
        <ModalConfirmAction
            cancelLabel={t.common.actions.cancel}
            entityName={name}
            open={open}
            zIndex={zIndex}
            onClose={onClose}
            onConfirm={onConfirm}
            {...words}
        />
    );
};
