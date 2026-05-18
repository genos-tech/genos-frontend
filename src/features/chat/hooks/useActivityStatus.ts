import { useEffect, useState } from "react";

import { activityChannel } from "../../../db/workers/channels";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../types/admin";
import { ActivityMessageProps } from "../../../types/chat";
import { GroupedReactionProps, ReactionProps } from "../../../types/common";

interface UseActivityStatusProps {
    activity: ActivityMessageProps;
    activityMessages: ActivityMessageProps[];
    useCM: ChatManagementState;
    myself: UserProps;
    accessToken: string | null;
}

export const useActivityStatus = ({
    activity,
    activityMessages,
    useCM,
    myself,
    accessToken,
}: UseActivityStatusProps) => {
    const [groupedReactions, setGroupedReactions] = useState<GroupedReactionProps[]>([]);

    const groupEmojis = (reactions: ReactionProps[]): GroupedReactionProps[] => {
        const map = new Map<string, { count: number; senders: UserProps[] }>();

        reactions.forEach(({ emoji, sender }) => {
            const entry = map.get(emoji);
            if (entry) {
                entry.count += 1;
                entry.senders.push(sender);
            } else {
                map.set(emoji, { count: 1, senders: [sender] });
            }
        });

        return Array.from(map.entries())
            .map(([emoji, { count, senders }]) => ({
                emoji,
                count,
                senders,
            }))
            .sort((a, b) => b.count - a.count);
    };

    const updateActivityReadStatus = () => {
        if (!accessToken || !activity.activityId) return;
        activityChannel
            .request("updateActivityReadStatus", {
                accessToken,
                myself,
                activityId: activity.activityId,
                isRead: true,
                activityMessages,
            })
            .then((data) => {
                if (Array.isArray(data)) {
                    useCM.setActivityMessages(data);
                } else if (data && "error" in data) {
                    console.error("updateActivityReadStatus failed:", data.error);
                }
            })
            .catch((err) => {
                console.error("updateActivityReadStatus error:", err);
            });
    };

    useEffect(() => {
        setGroupedReactions(groupEmojis(activity.reactions));
    }, [activity]);

    return {
        groupedReactions,
        updateActivityReadStatus,
    };
};
