import { Box, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { UserProps } from "../../../../types/admin";
import { extractMMDDHHMMSSs } from "../../../../utils/dateUtils";
import { statuses } from "../../../tasks/utils/taskMeta";

type BubbleUserNameTypes = {
    isSimpleBubble: boolean;
    sender: UserProps;
    chatType: number;
    userName: string;
    isSent: boolean;
    dtSent: string;
    tsSent: string;
    tsUpdated: string;
    taskId: number | null;
    taskStatus: string | null;
    isThread: boolean;
};
export const BubbleUserName = (props: BubbleUserNameTypes) => {
    const {
        isSimpleBubble,
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
                                        (chatType === 3 || chatType === 4) &&
                                        sender.isSystemUser === true
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
                            {isThread === false && (
                                <>
                                    <Chip
                                        key={taskId}
                                        variant="soft"
                                        color="neutral"
                                        sx={{
                                            marginRight: taskStatusDetails ? "5px" : "7px",
                                            borderRadius: "5px",
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
                                            marginRight: "10px",
                                            fontWeight: "bold",
                                            borderRadius: "5px",
                                        }}
                                    >
                                        {taskStatus || "N/A"}
                                    </Chip>
                                </>
                            )}
                            {isEdited === true && (
                                <Typography sx={{ marginRight: "10px" }}>
                                    {sender.isSystemUser === true && (
                                        <>
                                            {isThread === true && <>{dtSent}</>}
                                            {isThread === false && <>{dtSent} Updated</>}
                                        </>
                                    )}
                                    {sender.isSystemUser !== true && <>{dtSent} Edited</>}
                                </Typography>
                            )}
                            {isEdited === false && <>{dtSent}</>}
                        </Typography>
                    </>
                )}

                {/* Message bubble for normal users (not system users)*/}
                {!sender.isSystemUser && (
                    <>
                        {isSimpleBubble === false && (
                            <Typography
                                level="body-md"
                                component="span"
                                sx={[
                                    { lineHeight: 1.5, marginRight: "10px" },
                                    isSent
                                        ? { color: "background.body" }
                                        : { color: "var(--joy-palette-text-primary)" },
                                ]}
                            >
                                {userName}
                            </Typography>
                        )}

                        <Typography
                            level="body-xs"
                            sx={[
                                {
                                    lineHeight: 1.5,
                                    paddingTop: isSimpleBubble === true ? 1 : 0,
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
