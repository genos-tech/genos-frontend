import React, { useEffect, useState, useRef, useCallback } from "react";
import { FixedSizeList as List, ListOnScrollProps } from "react-window";
import { Box } from '@mui/joy';

type Message = {
    id: number;
    text: string;
};

const ChatWindow: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const listRef = useRef<List>(null);
    const hasMore = useRef(true); // Simulate if more messages are available
    const isFetching = useRef(false); // Prevent duplicate fetches

    // Simulated IndexedDB fetch function (replace with real fetch)
    const fetchOlderMessages = async () => {
        console.log("hasMore.current:", hasMore.current)
        console.log("isFetching.current", isFetching.current)

        if (!hasMore.current || isFetching.current) return;
        isFetching.current = true;

        console.log("Load more...")

        return new Promise<Message[]>((resolve) =>
            setTimeout(() => {
                const moreMessages = Array.from({ length: 20 }, (_, i) => ({
                    id: messages.length + i,
                    text: `Older Message ${messages.length + i + 1}`,
                }));
                resolve(moreMessages);
            }, 500)
        );
    };

    // Load initial messages
    useEffect(() => {
        const loadInitialMessages = async () => {
            const initialMessages = Array.from({ length: 50 }, (_, i) => ({
                id: i,
                text: `Message ${i + 1}`,
            }));
            setMessages(initialMessages.reverse()); // Show latest messages at bottom
        };

        loadInitialMessages();
    }, []);

    // Handle scroll event (detect when near top)
    const handleScroll = async ({ scrollOffset }: ListOnScrollProps) => {
        console.log("scrollOffset:", scrollOffset)
        if (scrollOffset === 0) { // User scrolled to the top
            const olderMessages = await fetchOlderMessages();
            const oldData = {
                messagesLength: olderMessages?.length || 0
            }

            console.log("oldData.messagesLength:", oldData.messagesLength)
            console.log("olderMessages:", olderMessages)

            if (olderMessages !== undefined) {
                console.log("here")
                if
                    (oldData.messagesLength === 0) {
                    hasMore.current = false;
                    console.log("heef")
                }

                setMessages((prev) => [...olderMessages, ...prev]); // Prepend new messages

                requestAnimationFrame(() => {
                    listRef.current?.scrollToItem(olderMessages.length, "start"); // Maintain scroll position
                });

                oldData.messagesLength = 0
                isFetching.current = false

            }
        }
    };

    return (
        <div>
            <Box width={'100vw'}>
                <List
                    height={500}
                    itemCount={messages.length}
                    itemSize={50}
                    width="100%"
                    ref={listRef}
                    onScroll={handleScroll} // ✅ Fixed scroll event
                >
                    {({ index, style }) => (
                        <div style={{ ...style, padding: "10px", borderBottom: "1px solid #ddd" }}>
                            {messages[index].text}
                        </div>
                    )}
                </List>
            </Box>
        </div>
    );
};

export default ChatWindow;
