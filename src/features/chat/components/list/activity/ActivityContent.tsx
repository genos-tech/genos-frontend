import { Box, Stack, Typography } from "@mui/joy";
import React from "react";

import { UserProps } from "../../../../../types/admin";
import { ActivityMessageProps } from "../../../../../types/chat";
import { GroupedReactionProps } from "../../../../../types/common";
import { ActivityReactions } from "./ActivityReactions";

interface ActivityContentProps {
    activity: ActivityMessageProps;
    myself: UserProps;
    groupedReactions: GroupedReactionProps[];
}

export const ActivityContent: React.FC<ActivityContentProps> = ({
    activity,
    myself,
    groupedReactions,
}) => {
    // For non-reaction activities, show the first line content
    if (activity.activityType !== 2) {
        return (
            <Stack alignItems="flex-start" direction="row" justifyContent="space-between">
                <Typography
                    level="body-sm"
                    sx={{
                        marginBottom: 0.5,
                        ml: "45px",
                        fontWeight: "bold",
                        display: "-webkit-box",
                        WebkitLineClamp: "2",
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {activity.firstLineContent}
                </Typography>
            </Stack>
        );
    }

    // For reaction activities, show the reaction display
    return (
        <>
            <ActivityReactions
                activity={activity}
                groupedReactions={groupedReactions}
                myself={myself}
            />
            <Box sx={{ lineHeight: 0, textAlign: "right" }}>
                <Typography
                    level="body-sm"
                    sx={{
                        marginBottom: 0.5,
                        ml: "45px",
                        fontWeight: "bold",
                        display: "-webkit-box",
                        WebkitLineClamp: "2",
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {activity.firstLineContent}
                </Typography>
            </Box>
        </>
    );
};
