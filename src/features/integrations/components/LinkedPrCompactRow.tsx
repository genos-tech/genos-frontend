import { useEffect, useState } from "react";
import { Box, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import type { TaskDeliveryProps } from "../../../types/tasks";
import { getCachedOrFetchPrStatus, type PrStatusResult } from "../services/prStatusCache";
import type { PrDetailResponse } from "../services/prTypes";
import { parsePrUrl } from "../utils/parsePrUrl";
import { derivePrState, prStateColor, type PrState } from "../utils/prState";
import { PrClosedIcon, PrDraftIcon, PrMergedIcon, PrOpenIcon } from "./icons/Octicons";
import { PrHoverDetails } from "./PrHoverDetails";

interface Props {
    url: string;
    accessToken: string;
    /** The delivery that says this PR is merged or closed. */
    delivery: TaskDeliveryProps;
}

/**
 * One line for a merged or closed PR in the task preview (MIP-998).
 *
 * Drawn from the delivery the preview already holds, so it sends nothing at
 * mount. The first hover or focus fetches the PR detail (shared with every
 * other consumer through `prStatusCache`) and the tooltip upgrades to the rich
 * hover card, the same one the table chip shows. Clicking opens the PR on
 * GitHub, like the full card does.
 */
export const LinkedPrCompactRow = ({ url, accessToken, delivery }: Props) => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const ref = parsePrUrl(url);
    const [asked, setAsked] = useState(false);
    const [detail, setDetail] = useState<PrStatusResult | null>(null);

    useEffect(() => {
        if (!asked || !accessToken) return;
        let cancelled = false;
        void (async () => {
            const r = await getCachedOrFetchPrStatus(accessToken, url);
            if (!cancelled) setDetail(r);
        })();
        return () => {
            cancelled = true;
        };
    }, [asked, accessToken, url]);
    const ask = () => setAsked(true);

    const loaded = detail?.kind === "ok" ? (detail.payload as PrDetailResponse) : null;
    // The delivery decides until the live detail says otherwise.
    const state: PrState = loaded
        ? derivePrState(loaded.pull)
        : delivery.state === "merged"
          ? "merged"
          : "closed";
    const stateLabel = t.integrations.pullRequest.linkedCard.state[state];
    const repoLabel = ref ? `${ref.owner}/${ref.repo} #${ref.number}` : url;
    const title = loaded?.pull.title || delivery.pr_title || "";
    const color = prStateColor(state);
    const Icon = {
        merged: PrMergedIcon,
        closed: PrClosedIcon,
        open: PrOpenIcon,
        draft: PrDraftIcon,
    }[state];

    const hover = loaded ? (
        <PrHoverDetails isDark={isDark} payload={loaded} includeHeader />
    ) : (
        <Stack spacing={0.25} sx={{ p: 0.5, color: palette.text }}>
            <Box sx={{ fontWeight: 600 }}>{repoLabel}</Box>
            {title && <Box sx={{ fontSize: 11, color: palette.textMuted }}>{title}</Box>}
            {/* State only: "No CI" would claim something nobody asked about yet. */}
            <Box sx={{ fontSize: 11 }}>{stateLabel}</Box>
        </Stack>
    );

    return (
        <AppTooltip
            arrowColor={loaded ? palette.surfaceSolid : undefined}
            maxWidth={loaded ? 320 : undefined}
            placement="top-start"
            size="sm"
            surface={loaded ? "none" : "chip"}
            title={hover}
        >
            <Box
                component="a"
                href={url}
                rel="noreferrer"
                target="_blank"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    minWidth: 0,
                    px: 1,
                    py: 0.5,
                    cursor: "pointer",
                    textDecoration: "none",
                    color: "inherit",
                    borderRadius: "6px",
                    background: palette.chipBg,
                    border: `1px solid ${palette.chipBorder}`,
                    transition: "background-color 0.15s ease, border-color 0.15s ease",
                    "&:hover": {
                        background: palette.buttonBgHover,
                        borderColor: palette.borderStrong,
                    },
                }}
                onFocus={ask}
                onMouseEnter={ask}
            >
                <Icon height={14} style={{ color, flexShrink: 0 }} width={14} />
                <Box sx={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{repoLabel}</Box>
                <Box
                    sx={{
                        fontSize: 12,
                        color: palette.textMuted,
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {title}
                </Box>
                <Box sx={{ fontSize: 11, color, flexShrink: 0 }}>{stateLabel}</Box>
            </Box>
        </AppTooltip>
    );
};
