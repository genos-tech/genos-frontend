import CheckKnownChatWorker from "../../../workers/checkKnownChatWorker.ts?worker";

export const checkKnownChat = (
    chatId: number,
    chatType: number
): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        const checkKnownChatWorker = new CheckKnownChatWorker();

        checkKnownChatWorker.postMessage({
            chatId,
            chatType,
        });

        checkKnownChatWorker.onmessage = (event) => {
            checkKnownChatWorker.terminate();
            resolve(event.data as boolean);
        };

        checkKnownChatWorker.onerror = (error) => {
            checkKnownChatWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
