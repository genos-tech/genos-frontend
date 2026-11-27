import { getFirstLine } from "../../../features/chat/utils/common";

/** The first line of a scheduled message that says something (MIP-2482), as the chat list would
 *  word it; "" for anything that is not a message body. */
export const messagePreview = (body: unknown): string => {
    if (!Array.isArray(body)) return "";
    for (const block of body) {
        const line = getFirstLine(block).trim();
        if (line) return line;
    }
    return "";
};
