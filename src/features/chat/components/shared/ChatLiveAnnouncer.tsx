import { Box } from "@mui/joy";

import { visuallyHidden } from "../../../../components/ui/a11y/visuallyHidden";
import { useIncomingMessageAnnouncer } from "../../hooks/useIncomingMessageAnnouncer";

/**
 * A screen reader is told when someone else writes in the open conversation (MIP-1956). A
 * visually hidden polite status region, a SIBLING of the virtualized list: `role="log"` on the list
 * would announce every row scrolling in. Mount it with `key` = the conversation, so switching chats
 * drops anything still queued for the previous one.
 */
export const ChatLiveAnnouncer = ({
    chatId,
    threadId,
    myselfId,
}: {
    chatId: string;
    threadId?: string;
    myselfId: string;
}) => {
    const text = useIncomingMessageAnnouncer({ chatId, threadId }, myselfId);
    return (
        <Box aria-atomic="true" aria-live="polite" role="status" sx={visuallyHidden}>
            {text}
        </Box>
    );
};
