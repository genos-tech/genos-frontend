import { ListItemContent } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import { Socket } from "socket.io-client";

import { useTranslation } from "../../../../i18n";
import { TaskProps } from "../../../../types/tasks";
import { statuses, taskMetaLabel } from "../../utils/taskMeta";
import { StatusLabel } from "../meta/StatusLabel";

type ACTaskStatusProps = {
    socket: Socket | null;
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
    setTaskStatusUpdated?: (value: boolean) => void;
};
export const ACTaskStatus = (props: ACTaskStatusProps) => {
    const { socket, taskContent, setTaskContent, setTaskUpdated, setTaskStatusUpdated } = props;

    const { t } = useTranslation();

    return (
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
                    (async () => {
                        setTaskContent({
                            ...taskContent,
                            status: value.slice(-1)[0],
                        });
                        if (setTaskStatusUpdated) {
                            setTaskStatusUpdated(true);
                        }
                        if (setTaskUpdated) {
                            setTaskUpdated(true);
                        }
                    })();
                }
            }}
        />
    );
};
