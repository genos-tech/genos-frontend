import { Fragment, useMemo } from "react";
import { ListItemContent } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import { Socket } from "socket.io-client";

import { useProjectStatuses } from "../../../../hooks/tasks/useProjectStatuses";
import { useTranslation } from "../../../../i18n";
import { TaskProps, TaskStatusProps } from "../../../../types/tasks";
import { isDeletingStatus } from "../../utils/deletedStatus";
import { keptCustomStatusId } from "../../utils/projectStatus";
import { statuses, taskMetaLabel } from "../../utils/taskMeta";
import { StatusLabel } from "../meta/StatusLabel";
import { GroupedStatusPicker } from "../statuses/GroupedStatusPicker";
import { PickerField, pickerInputProps } from "./pickerField";

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
    field?: PickerField;
};
export const ACTaskStatus = (props: ACTaskStatusProps) => {
    const { taskContent, setTaskContent, setTaskUpdated, setTaskStatusUpdated, onDeleteTask } =
        props;
    const { field } = props;

    const { t } = useTranslation();
    const options = useMemo(
        () => (onDeleteTask ? statuses : statuses.filter((s) => s.status !== "Deleted")),
        [onDeleteTask]
    );

    // A project that set up statuses offers its own, grouped (MIP-2493).
    const { statuses: projectStatuses } = useProjectStatuses(
        taskContent?.project?.projectId,
        taskContent?.customStatusId
    );

    const applyStatus = (status: TaskStatusProps, statusId?: number) => {
        setTaskContent({
            ...taskContent,
            status,
            customStatusId:
                statusId ??
                keptCustomStatusId(
                    taskContent.status?.status,
                    status.status,
                    taskContent.customStatusId
                ),
            customStatusPick: statusId,
        });
        if (setTaskStatusUpdated) {
            setTaskStatusUpdated(true);
        }
        if (setTaskUpdated) {
            setTaskUpdated(true);
        }
    };

    const pickStatus = (next: TaskStatusProps, statusId?: number) => {
        if (isDeletingStatus(next.status, taskContent.status?.status)) {
            onDeleteTask?.();
            return;
        }
        applyStatus(next, statusId);
    };

    if (projectStatuses.length > 0) {
        return (
            <GroupedStatusPicker
                key={taskContent.id}
                customStatusId={taskContent.customStatusId}
                field={field}
                offerDelete={!!onDeleteTask}
                rows={projectStatuses}
                status={taskContent.status?.status ?? ""}
                onPick={(category, statusId) => {
                    const meta = statuses.find((s) => s.status === category);
                    if (meta) pickStatus(meta, statusId);
                }}
            />
        );
    }

    return (
        <Fragment>
            <Autocomplete
                key={taskContent.id}
                error={field?.invalid}
                getOptionLabel={(option) => taskMetaLabel(option.status, t.tasks.filters)}
                isOptionEqualToValue={(option, value) => option.status === value.status}
                options={options}
                placeholder={t.tasks.autocomplete.statusPlaceholder}
                size="sm"
                slotProps={{ input: pickerInputProps(field) }}
                sx={{ width: "100%" }}
                // No status yet (a rule being written) is an empty field, not an empty chip.
                value={taskContent?.status?.status ? [taskContent.status] : []}
                renderOption={(props, option) => (
                    <AutocompleteOption {...props} key={option.status}>
                        <ListItemContent sx={{ fontSize: "sm" }}>
                            <StatusLabel status={option.status} />
                        </ListItemContent>
                    </AutocompleteOption>
                )}
                renderTags={(tags, getTagProps) =>
                    tags.slice(-1).map((item, index) => {
                        const { key } = getTagProps({ index }); // only the 'key' is needed
                        return <StatusLabel key={key} status={item.status} />;
                    })
                }
                multiple
                onChange={(event, value) => {
                    if (value !== null && value.length > 0) {
                        pickStatus(value.slice(-1)[0]);
                    }
                }}
            />
        </Fragment>
    );
};
