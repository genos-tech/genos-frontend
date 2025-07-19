import { Box, Typography, Stack, Chip } from "@mui/joy";

import { UserProps } from "../../../../types/admin";

type BubbleUserNameTypes = {
    sender: UserProps;
    chatType: number;
    userName: string;
    isSent: boolean;
    tsSent: string;
};
export const BubbleUserName = (props: BubbleUserNameTypes) => {
    const { sender, chatType, userName, isSent, tsSent } = props;
    return (
        <Box sx={{ flex: 1 }}>
            <Stack
                direction="column"
                justifyContent={isSent ? "flex-end" : "flex-start"}
                alignItems="left"
            >
                {chatType === 3 && sender.isSystemUser === true && (
                    <>
                        <Typography
                            level="body-sm"
                            component="span"
                            sx={[
                                {
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
                            <Chip
                                variant="outlined"
                                color="neutral"
                                sx={{
                                    marginTop: "5px",
                                    marginRight: "7px",
                                    borderRadius: "7px",
                                }}
                                size="lg"
                            >
                                Task Status
                            </Chip>
                            {tsSent}
                        </Typography>
                    </>
                )}

                {!(chatType === 3 && sender.isSystemUser === true) && (
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
                            {tsSent}
                        </Typography>
                    </>
                )}
            </Stack>
        </Box>
    );
};
