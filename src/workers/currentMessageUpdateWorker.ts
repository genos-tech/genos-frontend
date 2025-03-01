// messageWorker.ts
self.onmessage = (event) => {
    const { messages, newMessage } = event.data;

    // Efficiently append the new message
    const updatedMessages = [...messages, newMessage];

    // Sort messages by tsSent in ascending order
    const sortedMessages = [...updatedMessages].sort((a, b) => {
        return new Date(a.tsSent).getTime() - new Date(b.tsSent).getTime();
    });

    // Send the updated messages back to the main thread
    self.postMessage(sortedMessages);
};
