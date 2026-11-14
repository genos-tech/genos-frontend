import HubRoundedIcon from "@mui/icons-material/HubRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import { Chip } from "@mui/joy";

import type { ViaSource } from "../../../features/tasks/utils/viaSource";
import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { AppTooltip } from "../AppTooltip";
import { ViaAppIcon } from "./ViaAppIcon";

type ViaChipProps = {
    /** What `viaSourceOfRow` / `viaSourceOfComment` decided. `name` is only
     *  ever set for the owner; this component shows what it is given. */
    source: ViaSource;
    /** `sm` on a history row or comment header. */
    size?: "sm" | "md";
};

/**
 * "This was made through a connected AI app (MCP) or an API key, not typed in
 * Genos" (MIP-1376).
 *
 * One component for every surface that has to say it (history rows, comment
 * cards), so the mark reads as the SAME mark wherever it appears. It sits next to
 * the person's avatar and name and removes nothing: technically the person did
 * it, by asking their AI app, and the chip only says how.
 *
 * The words carry the meaning, so they are always visible; the icon is
 * decoration. The key's or app's name is in the tooltip, and only the owner is
 * ever handed one.
 *
 * When the server names the official app behind a connected app (`source.app`:
 * "claude" or "chatgpt", MIP-1568), the chip is that app's own small round mark
 * instead, and the words move to its accessible name and tooltip ("via Claude").
 * Any other app, an API key, or an older server that sends no family keeps the
 * generic chip above, unchanged.
 */
export const ViaChip = ({ source, size = "sm" }: ViaChipProps) => {
    const { t } = useTranslation();
    const v = t.tasks.activity.via;
    const isMcp = source.kind === "mcp";
    const label = isMcp ? v.mcp : v.apiKey;
    const hint = source.name
        ? fmt(isMcp ? v.mcpHintNamed : v.apiKeyHintNamed, { name: source.name })
        : isMcp
          ? v.mcpHint
          : v.apiKeyHint;
    const iconSize = size === "sm" ? 12 : 14;

    if (isMcp && source.app) {
        const appName = v.apps[source.app];
        const appHint = source.name
            ? fmt(v.appHintNamed, { app: appName, name: source.name })
            : fmt(v.appHint, { app: appName });
        return (
            <AppTooltip size="sm" title={appHint}>
                <ViaAppIcon app={source.app} size={size === "sm" ? 16 : 18} />
            </AppTooltip>
        );
    }

    return (
        <AppTooltip size="sm" title={hint}>
            <Chip
                data-via={source.kind}
                size={size}
                startDecorator={
                    isMcp ? (
                        <HubRoundedIcon sx={{ fontSize: iconSize }} />
                    ) : (
                        <KeyRoundedIcon sx={{ fontSize: iconSize }} />
                    )
                }
                variant="soft"
                sx={{
                    flexShrink: 0,
                    fontSize: size === "sm" ? "0.65rem" : "0.7rem",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    backgroundColor: g.info.subtle,
                    color: g.info.text,
                    "--Chip-gap": "2px",
                }}
            >
                {label}
            </Chip>
        </AppTooltip>
    );
};
