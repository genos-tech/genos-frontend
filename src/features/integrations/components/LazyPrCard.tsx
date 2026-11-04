import { useState } from "react";
import GitHubIcon from "@mui/icons-material/GitHub";
import { Card, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { purplePalette } from "../../../theme/purplePalette";
import { parsePrUrl } from "../utils/parsePrUrl";
import { LinkedPrCard } from "./LinkedPrCard";

interface Props {
    url: string;
    accessToken: string;
    /** Passed to the card once it is shown: nothing for a user without GitHub connected. */
    hideOnNotConnected?: boolean;
}

/**
 * The PR card, loaded when someone looks at it (MIP-1003).
 *
 * A PR link in a task comment or a chat message used to draw the full
 * `LinkedPrCard` at once, and every card fetches the PR detail (three GitHub
 * calls on the server) as it mounts, so a comment listing several PRs sent that
 * many requests the moment a task opened. Now each link first draws a card-shaped
 * placeholder (the same outlined shell, a GitHub icon and `owner/repo #n`) that
 * sends nothing. Hovering, focusing or clicking it swaps in the real
 * `LinkedPrCard` in the same slot, which loads and shows exactly what it always
 * showed. The request starts at that moment and not before.
 *
 * Click counts too, so touch screens (no hover) can load it. The placeholder
 * cannot know in advance that a user has no GitHub connected, so for them it
 * shows until the card, which hides itself, replaces it.
 */
export const LazyPrCard = ({ url, accessToken, hideOnNotConnected }: Props) => {
    const { mode } = useColorScheme();
    const palette = mode === "dark" ? purplePalette.dark : purplePalette.light;
    const [revealed, setRevealed] = useState(false);

    if (revealed) {
        return (
            <LinkedPrCard
                accessToken={accessToken}
                hideOnNotConnected={hideOnNotConnected}
                url={url}
            />
        );
    }

    const ref = parsePrUrl(url);
    const label = ref ? `${ref.owner}/${ref.repo} #${ref.number}` : url;
    const reveal = () => setRevealed(true);
    return (
        <Card
            aria-label={label}
            role="button"
            sx={{
                p: 1.5,
                cursor: "pointer",
                "&:hover": { borderColor: "primary.500" },
            }}
            tabIndex={0}
            variant="outlined"
            onClick={reveal}
            onFocus={reveal}
            onMouseEnter={reveal}
        >
            <Stack alignItems="center" direction="row" spacing={1.25} sx={{ py: 0.5 }}>
                <GitHubIcon sx={{ color: "neutral.500" }} />
                <Typography level="body-sm" sx={{ color: palette.textMuted, fontWeight: 600 }}>
                    {label}
                </Typography>
            </Stack>
        </Card>
    );
};
