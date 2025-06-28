import { Box, Typography, Stack } from "@mui/joy";

type BubbleUserNameTypes = {
    userName: string;
    isSent: boolean;
    tsSent: string;
};
export const BubbleUserName = (props: BubbleUserNameTypes) => {
    const { userName, isSent, tsSent } = props;
    return (
        <Box sx={{ flex: 1 }}>
            <Stack
                direction="column"
                justifyContent={isSent ? "flex-end" : "flex-start"}
                alignItems="left"
            >
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
                    {tsSent}
                </Typography>
            </Stack>
        </Box>
    );
};
