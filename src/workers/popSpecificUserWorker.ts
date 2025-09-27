import { STORES } from "../db/conf";
import { getData } from "../db/crud";

self.onmessage = async (event) => {
    const userId: number = event.data.userId;

    if (userId) {
        const chat = await getData({
            storeName: STORES.USER_INFO,
            key: userId,
        });

        if (chat) {
            self.postMessage(chat);
        } else {
            self.postMessage(null);
        }
    }

    self.close(); // Terminates itself
};

export {};
