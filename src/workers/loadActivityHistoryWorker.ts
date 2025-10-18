import { ActivityService } from "../db/services";
import { loadActivityHistory } from "../features/chat/services/loadActivityHistory";
import { UserProps } from "../types/admin";
import { ActivityMessageProps } from "../types/chat";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    const activityService = new ActivityService();
    await activityService.clearActivityMessages();

    // Load data from backend
    const activityHistory: ActivityMessageProps[] | undefined = await loadActivityHistory(
        myself,
        accessToken
    );

    if (activityHistory) {
        for (let i = 0; i < activityHistory.length; i += BATCH_SIZE) {
            const miniBatch: ActivityMessageProps[] = activityHistory.slice(i, i + BATCH_SIZE);
            await activityService.batchInsertActivityMessages(miniBatch);
        }

        // Send finish a message
        self.postMessage("done");
    } else {
        self.postMessage("done");
    }

    self.close(); // Terminates itself
};

export {};
