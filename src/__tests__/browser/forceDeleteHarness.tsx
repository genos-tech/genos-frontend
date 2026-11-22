/* eslint-disable react-refresh/only-export-components -- a page entry, nothing imports it */
/**
 * The page `ForceDeleteDialogMIP1584.test.ts` loads: the REAL `ForceDeleteDialog` (so the real
 * `ConfirmDialog` and `ModalFrame`) with a very long task title, inside the app's theme, no backend.
 * `?mode=dark` selects the dark scheme; `?fail=1` makes the delete refuse with a 403.
 */
import "@fontsource-variable/geist/index.css";
import "../../index.css";

import { useEffect } from "react";
import { useColorScheme } from "@mui/joy/styles";
import { createRoot } from "react-dom/client";

import { ForceDeleteDialog } from "../../components/ui/modal/ForceDeleteDialog";
import { I18nProvider, useTranslation } from "../../i18n";
import { ForceDeleteError } from "../../services/forceDelete";
import { ColorThemeProvider } from "../../theme/ColorThemeProvider";

const TITLE =
    "Migrate the notification delivery pipeline to the new queue and backfill every historical subscription record for all teams";
const params = new URLSearchParams(window.location.search);
const w = window as unknown as { __deleted: number };
w.__deleted = 0;

const Page = () => {
    const { setMode } = useColorScheme();
    const { t } = useTranslation();
    const mode = params.get("mode") === "dark" ? "dark" : "light";
    useEffect(() => setMode(mode), [mode, setMode]);
    return (
        <ForceDeleteDialog
            description={t.common.forceDelete.taskDescription}
            entityName={TITLE}
            title={t.common.forceDelete.taskTitle}
            open
            onClose={() => {}}
            onConfirm={async () => {
                if (params.get("fail")) throw new ForceDeleteError(403, "forbidden", "no");
                w.__deleted += 1;
            }}
        />
    );
};

createRoot(document.getElementById("root")!).render(
    <ColorThemeProvider>
        <I18nProvider>
            <Page />
        </I18nProvider>
    </ColorThemeProvider>
);
