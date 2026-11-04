import { Stack } from "@mui/joy";

import { LinkedPrCompactRow } from "./LinkedPrCompactRow";

/**
 * The PR links of a message or a task comment, under its body (MIP-1000).
 *
 * Each used to be a full `LinkedPrCard` that fetched the PR detail (three
 * GitHub calls on the server) the moment it mounted, so opening a task whose
 * comments list a dozen PRs sent a dozen requests at once. Now each is a
 * one-line chip that fetches only when it is hovered or focused.
 *
 * Shared by the two message renderers (`LightMessageBody`, `BnChatPreview`),
 * which had the same block copied. The caller caps `urls` and decides when
 * there is a session to ask with.
 */
export const MessagePrUnfurls = ({
    urls,
    accessToken,
}: {
    urls: string[];
    accessToken: string;
}) => (
    <Stack spacing={0.75} sx={{ mt: 0.75, mb: 0.5 }}>
        {urls.map((url) => (
            <LinkedPrCompactRow key={url} accessToken={accessToken} url={url} />
        ))}
    </Stack>
);
