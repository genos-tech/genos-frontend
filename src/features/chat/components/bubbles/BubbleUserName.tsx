import { alpha } from "@mui/system";
import { Box, Typography, Stack, Chip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { UserProps } from "../../../../types/admin";
import { statuses } from "../../../tasks/utils/taskMeta";
import { extractMMDDHHMMSSs } from "../../../../utils/dateUtils";

type BubbleUserNameTypes = {
    sender: UserProps;
    chatType: number;
    userName: string;
    isSent: boolean;
    dtSent: string;
    tsSent: string;
    tsUpdated: string;
    taskId: number | null;
    taskStatus: string | null;
    isThread?: boolean;
};
export const BubbleUserName = (props: BubbleUserNameTypes) => {
    const {
        sender,
        chatType,
        userName,
        isSent,
        dtSent,
        tsSent,
        tsUpdated,
        taskId,
        taskStatus,
        isThread,
    } = props;
    const { mode } = useColorScheme();
    const taskStatusDetails = statuses.find((item) => item.status === taskStatus);
    const isEdited = extractMMDDHHMMSSs(tsSent) === extractMMDDHHMMSSs(tsUpdated) ? false : true;

    return (
        <Box sx={{ flex: 1 }}>
            <Stack
                direction="column"
                justifyContent={isSent ? "flex-end" : "flex-start"}
                alignItems="left"
            >
                {/* Task update message bubble */}
                {sender.isSystemUser === true && (
                    <>
                        <Typography
                            level="body-sm"
                            component="span"
                            sx={[
                                {
                                    marginTop: "3px",
                                    marginLeft:
                                        chatType === 3 && sender.isSystemUser === true
                                            ? "5px"
                                            : "0px",
                                },
                                isSent
                                    ? {
                                          color: "background.body",
                                      }
                                    : {
                                          color: "var(--joy-palette-text-primary)",
                                      },
                            ]}
                        >
                            {isThread === undefined && (
                                <>
                                    <Chip
                                        key={taskId}
                                        variant="soft"
                                        color="neutral"
                                        sx={{
                                            marginRight: taskStatusDetails ? "2px" : "7px",
                                            borderRadius: "7px",
                                            fontWeight: "bold",
                                        }}
                                        size="lg"
                                    >
                                        ID: {taskId || "N/A"}
                                    </Chip>
                                </>
                            )}
                            {taskStatusDetails && (
                                <>
                                    <Chip
                                        key={taskStatus}
                                        size="lg"
                                        variant="soft"
                                        sx={{
                                            backgroundColor: taskStatusDetails.color
                                                ? alpha(
                                                      taskStatusDetails.color,
                                                      mode === "dark" ? 0.5 : 0.75
                                                  )
                                                : "transparent",
                                            color: taskStatusDetails.textColor,
                                            marginRight: "7px",
                                            fontWeight: "bold",
                                            borderRadius: "7px",
                                        }}
                                    >
                                        {taskStatus || "N/A"}
                                    </Chip>
                                </>
                            )}
                            {isEdited === true && <>{dtSent} Edited</>}
                            {isEdited === false && <>{dtSent}</>}
                        </Typography>
                    </>
                )}

                {/* Task update message bubble */}
                {!sender.isSystemUser && (
                    <>
                        <Typography
                            level="body-md"
                            component="span"
                            sx={[
                                { lineHeight: 1.5 },
                                isSent
                                    ? { color: "background.body" }
                                    : { color: "var(--joy-palette-text-primary)" },
                            ]}
                        >
                            {userName}
                        </Typography>

                        <Typography
                            level="body-xs"
                            sx={[
                                {
                                    lineHeight: 1.5,
                                },
                                isSent
                                    ? {
                                          color: "background.body",
                                      }
                                    : {
                                          color: "var(--joy-palette-text-primary)",
                                      },
                            ]}
                        >
                            {isEdited === true && <>{dtSent} Edited</>}
                            {isEdited === false && <>{dtSent}</>}
                        </Typography>
                    </>
                )}
            </Stack>
        </Box>
    );
};
