import { forwardRef } from "react";
import { Box } from "@mui/joy";

import chatgptMark from "../../../assets/ai-apps/chatgpt.svg";
import claudeMark from "../../../assets/ai-apps/claude.svg";
import type { ViaApp } from "../../../features/tasks/utils/viaSource";
import { fmt, useTranslation } from "../../../i18n";

type ViaAppIconProps = {
    /** The family the server named. `null` / `undefined` renders nothing, so a caller
     *  can place the icon unconditionally and the generic chip stays its own fallback. */
    app: ViaApp | null | undefined;
    /** Diameter in px. Default 16, the size of a chip's icon on a history row. */
    size?: number;
    /** Accessible name. Default "via Claude" / "via ChatGPT" (localized). */
    label?: string;
};

// Real files (see their header comments for source and licence), not inline paths: the
// brand colours live in the artwork, and Vite inlines each as a data URI (under 4 KB).
const MARK: Record<ViaApp, string> = { claude: claudeMark, chatgpt: chatgptMark };

/**
 * The small round mark of the AI app a change was made through (MIP-1568).
 *
 * Says only which integration acted; it is not Genos branding. A decorative-size
 * circle that is still a labelled image, so a screen reader hears "via Claude"
 * where a sighted reader sees the mark. It forwards its ref and props so a tooltip
 * can wrap it. Carries no name of the member's key or app: the family is the only
 * thing it can show.
 */
export const ViaAppIcon = forwardRef<HTMLSpanElement, ViaAppIconProps>(function ViaAppIcon(
    { app, size = 16, label, ...rest },
    ref
) {
    const { t } = useTranslation();
    if (app !== "claude" && app !== "chatgpt") return null;
    const v = t.tasks.activity.via;
    const text = label ?? fmt(v.viaApp, { app: v.apps[app] });

    return (
        <Box
            {...rest}
            ref={ref}
            aria-label={text}
            component="span"
            data-via-app={app}
            role="img"
            sx={{
                display: "inline-flex",
                flex: "none",
                height: size,
                lineHeight: 0,
                width: size,
            }}
        >
            <img
                alt=""
                draggable={false}
                height={size}
                src={MARK[app]}
                style={{ display: "block", borderRadius: "50%" }}
                width={size}
                aria-hidden
            />
        </Box>
    );
});
