import { useEffect, useState } from "react";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../types/admin";
import { ActivityMessageProps } from "../../../types/chat";
import { GroupedReactionProps, ReactionProps } from "../../../types/common";
import UpdateActivityReadStatusWorker from "../../../workers/updateActivityReadStatusWorker.ts?worker";

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
        if (accessToken && activity.activityId) {
            const updateActivityReadStatusWorker = new UpdateActivityReadStatusWorker();
            updateActivityReadStatusWorker.postMessage({
                accessToken: accessToken,
                myself: myself,
                activityId: activity.activityId,
                isRead: true,
                activityMessages: activityMessages,
            });
            updateActivityReadStatusWorker.onmessage = (event) => {
                const data = event.data;
                if (data.error) {
                    console.error("Worker failed:", data.error);
                } else {
                    useCM.setActivityMessages(data);
                }
            };
            return () => {
                updateActivityReadStatusWorker.terminate();
            };
        }
    };

    useEffect(() => {
        setGroupedReactions(groupEmojis(activity.reactions));
    }, [activity]);

    return {
        groupedReactions,
        updateActivityReadStatus,
    };
};
