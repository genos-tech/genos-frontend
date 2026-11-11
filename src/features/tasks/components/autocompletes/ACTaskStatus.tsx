import { Fragment, useMemo } from "react";
import { ListItemContent } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import { Socket } from "socket.io-client";

import { useTranslation } from "../../../../i18n";
import { TaskProps, TaskStatusProps } from "../../../../types/tasks";
import { isDeletingStatus } from "../../utils/deletedStatus";
import { statuses, taskMetaLabel } from "../../utils/taskMeta";
import { StatusLabel } from "../meta/StatusLabel";

type ACTaskStatusProps = {
    socket: Socket | null;
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
    setTaskStatusUpdated?: (value: boolean) => void;
    /**
     * Picking "Deleted" (MIP-1303): the host hides the task behind an Undo toast
     * and sends the delete when the toast is gone (`useDeleteTask`). The picker
     * never writes "Deleted" into the working copy: every autosave PUT carries
     * `status` and would delete at once. Without a handler the option is not
     * offered.
     */
    onDeleteTask?: () => void;
};
export const ACTaskStatus = (props: ACTaskStatusProps) => {
    const {
        socket,
        taskContent,
        setTaskContent,
        setTaskUpdated,
        setTaskStatusUpdated,
        onDeleteTask,
    } = props;

    const { t } = useTranslation();
    const options = useMemo(
        () => (onDeleteTask ? statuses : statuses.filter((s) => s.status !== "Deleted")),
        [onDeleteTask]
    );

    const applyStatus = (status: TaskStatusProps) => {
        setTaskContent({ ...taskContent, status });
        if (setTaskStatusUpdated) {
            setTaskStatusUpdated(true);
        }
        if (setTaskUpdated) {
            setTaskUpdated(true);
        }
    };

    return (
        <Fragment>
            <Autocomplete
                key={taskContent.id}
                getOptionLabel={(option) => taskMetaLabel(option.status, t.tasks.filters)}
                isOptionEqualToValue={(option, value) => option.status === value.status}
                options={options}
                placeholder={t.tasks.autocomplete.statusPlaceholder}
                size="sm"
                sx={{ width: "100%" }}
                value={taskContent ? [taskContent.status] : []}
                renderOption={(props, option) => (
                    <AutocompleteOption {...props} key={option.status}>
                        <ListItemContent sx={{ fontSize: "sm" }}>
                            <StatusLabel status={option.status} />
                        </ListItemContent>
                    </AutocompleteOption>
                )}
                renderTags={(tags, getTagProps) =>
                    tags.slice(-1).map((item, index) => {
                        const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                        return <StatusLabel key={key} status={item.status} />;
                    })
                }
                multiple
                onChange={(event, value) => {
                    if (value !== null && value.length > 0) {
                        const next = value.slice(-1)[0];
                        if (isDeletingStatus(next.status, taskContent.status?.status)) {
                            onDeleteTask?.();
                            return;
                        }
                        applyStatus(next);
                    }
                }}
            />
        </Fragment>
    );
};
