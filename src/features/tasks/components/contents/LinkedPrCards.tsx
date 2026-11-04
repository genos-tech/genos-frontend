import { Stack } from "@mui/joy";

import { LinkedPrCard } from "../../../integrations/components/LinkedPrCard";
import { LinkedPrCompactRow } from "../../../integrations/components/LinkedPrCompactRow";
import { prKey, type FinishedPrs } from "../../hooks/useFinishedPrDeliveries";

/**
 * The cards of the preview's "Linked pull requests" section (MIP-998): a PR
 * the deliveries say is merged or closed is one compact row (no request until
 * it is hovered); every other PR keeps the full card, as before. The order of
 * `urls` is kept.
 */
export const LinkedPrCards = ({
    urls,
    finished,
    accessToken,
}: {
    urls: string[];
    finished: FinishedPrs;
    accessToken: string;
}) => (
    <Stack spacing={1}>
        {urls.map((url) => {
            const key = prKey(url);
            const delivery = key ? finished.get(key) : undefined;
            return delivery ? (
                <LinkedPrCompactRow
                    key={url}
                    accessToken={accessToken}
                    delivery={delivery}
                    url={url}
                />
            ) : (
                <LinkedPrCard key={url} accessToken={accessToken} url={url} />
            );
        })}
    </Stack>
);
