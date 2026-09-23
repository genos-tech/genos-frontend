import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Snackbar, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";

interface Props {
    /** True during the brief announcement window before the reload. */
    open: boolean;
}

/**
 * Explains the imminent automatic reload (see `useIdleAutoReload`).
 *
 * It exists for one reason: a page that reloads itself with no warning
 * reads as a crash. Two seconds of "refreshing" turns the same flash into
 * something the user understands — and since the reload follows either way,
 * the message is deliberately a statement, not a question.
 *
 * `neutral`, unlike the `danger` connection banners, because nothing has
 * gone wrong from the user's side.
 */
export const IdleReloadSnackbar = ({ open }: Props) => {
    const { t } = useTranslation();
    return (
        <Snackbar
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
            color="neutral"
            open={open}
            sx={{ gap: 1 }}
            variant="soft"
        >
            <Typography
                level="body-sm"
                sx={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 1 }}
            >
                <RefreshRoundedIcon sx={{ fontSize: 16 }} />
                {t.app.snackbar.idleReload}
            </Typography>
        </Snackbar>
    );
};
