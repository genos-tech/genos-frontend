import { Fragment, useState } from "react";
import { ListItemContent } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import { Socket } from "socket.io-client";

import { useTranslation } from "../../../../i18n";
import { TaskProps, TaskStatusProps } from "../../../../types/tasks";
import { isDeletingStatus } from "../../utils/deletedStatus";
import { statuses, taskMetaLabel } from "../../utils/taskMeta";
import { StatusLabel } from "../meta/StatusLabel";
import { ConfirmDeletedStatus } from "../modals/ConfirmDeletedStatus";

type ACTaskStatusProps = {
    socket: Socket | null;
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
    setTaskStatusUpdated?: (value: boolean) => void;
    /** The layer of the modal this picker is shown in (UrlLinkModal), so the
     *  "Deleted" confirm opens above it. Page-hosted: omit. */
    hostZIndex?: number;
};
export const ACTaskStatus = (props: ACTaskStatusProps) => {
    const {
        socket,
        taskContent,
        setTaskContent,
        setTaskUpdated,
        setTaskStatusUpdated,
        hostZIndex,
    } = props;

    const { t } = useTranslation();
    // "Deleted" waits for a yes (MIP-1301). Until then the working copy keeps its
    // status, so the autosave (every PUT carries `status`) never sees it.
    const [pendingDeleted, setPendingDeleted] = useState<TaskStatusProps | null>(null);

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
                options={statuses}
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
                            setPendingDeleted(next);
                            return;
                        }
                        applyStatus(next);
                    }
                }}
            />
            {pendingDeleted && (
                <ConfirmDeletedStatus
                    entityName={taskContent.title}
                    hostZIndex={hostZIndex}
                    isMilestone={taskContent.isMilestone === true}
                    open
                    onClose={() => setPendingDeleted(null)}
                    onConfirm={() => applyStatus(pendingDeleted)}
                />
            )}
        </Fragment>
    );
};
