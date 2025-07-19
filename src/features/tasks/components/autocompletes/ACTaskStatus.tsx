import { Socket } from "socket.io-client";
import { alpha } from "@mui/system";
import { ListItemContent, Chip } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import { useColorScheme } from "@mui/joy/styles";

import { statuses } from "../../utils/taskMeta";
import { TaskProps } from "../../../../types/tasks";

type ACTaskStatusProps = {
    socket: Socket | null;
    taskContents: TaskProps;
    setTaskContents: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
};
export const ACTaskStatus = (props: ACTaskStatusProps) => {
    const { socket, taskContents, setTaskContents, setTaskUpdated } = props;

    const { mode } = useColorScheme();

    return (
        <Autocomplete
            key={taskContents.id}
            placeholder="Status"
            multiple
            options={statuses}
            value={taskContents ? [taskContents.status] : []}
            getOptionLabel={(option) => option.status || ""}
            isOptionEqualToValue={(option, value) => option.status === value.status}
            renderTags={(tags, getTagProps) =>
                tags.slice(-1).map((item, index) => {
                    const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                    return (
                        <Chip
                            key={key} // pass the key directly
                            variant="soft"
                            sx={{
                                backgroundColor: item.color
                                    ? alpha(item.color, mode === "dark" ? 0.5 : 0.75)
                                    : "transparent",
                                color: item.textColor,
                                fontWeight: "bold",
                                borderRadius: "7px",
                            }}
                            size="sm"
                        >
                            {item ? item.status : ""}
                        </Chip>
                    );
                })
            }
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={option.status}>
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <Chip
                            key={option.status} // pass the key directly
                            variant="soft"
                            sx={{
                                backgroundColor: option.color
                                    ? alpha(option.color, mode === "dark" ? 0.5 : 0.75)
                                    : "transparent",
                                color: option.textColor,
                                fontWeight: "bold",
                                borderRadius: "7px",
                            }}
                            size="sm"
                        >
                            {option.status}
                        </Chip>
                    </ListItemContent>
                </AutocompleteOption>
            )}
            onChange={(event, value) => {
                if (value !== null && value.length > 0) {
                    (async () => {
                        setTaskContents({
                            ...taskContents,
                            status: value.slice(-1)[0],
                        });
                        if (setTaskUpdated) {
                            setTaskUpdated(true);

                            // Send "task created" message
                            if (socket) {
                                // 1. join "pm" chat group
                                const createTaskMessage = [
                                    {
                                        type: "paragraph",
                                        props: {
                                            textColor: "default",
                                            textAlignment: "left",
                                            backgroundColor: "default",
                                        },
                                        content: [
                                            { text: "Mark task ", type: "text", styles: {} },
                                            {
                                                text: taskContents.title,
                                                type: "text",
                                                styles: { code: true },
                                            },
                                            {
                                                text: ` as ${value.slice(-1)[0].status} `,
                                                type: "text",
                                                styles: {},
                                            },
                                        ],
                                        children: [],
                                    },
                                    {
                                        type: "paragraph",
                                        props: {
                                            textColor: "default",
                                            textAlignment: "left",
                                            backgroundColor: "default",
                                        },
                                        content: [],
                                        children: [],
                                    },
                                ];
                                if (taskContents.project !== null && createTaskMessage) {
                                    console.log("taskContents:", taskContents);
                                    socket.emit("thread_message", {
                                        isInit: false,
                                        rootMessageTSSent: "",
                                        threadId: null, // TODO: update here!!!
                                        senderId: taskContents.project.systemUserId,
                                        senderName: taskContents.project.projectName,
                                        message: createTaskMessage,
                                        destCGName: taskContents.project.projectName,
                                        destCGId: taskContents.project.projectId,
                                        isDm: false,
                                        chatType: 3,
                                        dmPartnerUserId: null,
                                        systemUserId: taskContents.project.systemUserId,
                                        taskId: null,
                                    });
                                } else {
                                    console.error(
                                        "Failed to send task update message due to taskContents.project is NULL."
                                    );
                                }
                            } else {
                                console.error("socket not found");
                            }
                        }
                    })();
                }
            }}
            size="sm"
            sx={{ width: "100%" }}
        />
    );
};
