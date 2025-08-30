import { loadActivityHistory } from "../features/chat/services/loadActivityHistory";
import { UserProps } from "../types/admin";
import { ActivityMessageProps } from "../types/chat";
import { STORES } from "../db/conf";
import { clearStore, miniBatchInsertMessages } from "../db/crud";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.ACTIVITY_MESSAGES);

    // Load data from backend
    const activityHistory: ActivityMessageProps[] | undefined = await loadActivityHistory(
        myself.teamId,
        myself.teamName,
        myself.userId,
        accessToken
    );

    if (activityHistory) {
        for (let i = 0; i < activityHistory.length; i += BATCH_SIZE) {
            const miniBatchMessages: ActivityMessageProps[] = activityHistory.slice(
                i,
                i + BATCH_SIZE
            );
            await miniBatchInsertMessages({
                storeName: STORES.ACTIVITY_MESSAGES,
                miniBatchMessages: miniBatchMessages,
            });
        }

        // Send finish a message
        self.postMessage("done");
    } else {
        self.postMessage("done");
    }
};

export {};
