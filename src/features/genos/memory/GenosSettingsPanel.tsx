import { lazy, ReactNode, Suspense, useEffect, useRef, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import { Box, Button, Sheet, Stack, Typography } from "@mui/joy";

import { Spinner } from "../../../components/ui/feedback/Skeleton";
import { useTranslation } from "../../../i18n";

// Fetched when the card is first opened, not with the app. The Settings dialog
// is statically imported by the sidebar, so a plain import would put the whole
// page (and its two lists) on the entry chunk's critical path for a screen
// most sessions never open.
const GenosMemoryPage = lazy(() =>
    import("./GenosMemoryPage").then((module) => ({ default: module.GenosMemoryPage }))
);

interface Props {
    // The team the workspace is showing.
    teamId: string;
    // The model picker and answers/web-search sections. Passed in rather
    // than imported: they live in `SettingsModal`, which imports THIS file,
    // and a cycle between the two would be load-order roulette.
    children: ReactNode;
    onOpenLanguageSettings?: () => void;
}

type View = "settings" | "memory";

/**
 * The body of the Genos settings, in both places it appears (the "Genos" tab
 * of the main Settings dialog, and the dialog behind the gear on the Genos
 * bar): the usual sections, plus a card that opens "What Genos remembers".
 *
 * A sub-view with a way back, not a fourth and fifth section stacked under
 * the toggles. The page carries two lists that can run to dozens of rows, and
 * the gear dialog is the QUICK settings surface — someone flipping the model
 * should not have to scroll past their whole history to find the end of it.
 * It is local state, so closing and reopening the dialog starts at the usual
 * sections.
 */
export const GenosSettingsPanel = ({ teamId, children, onOpenLanguageSettings }: Props) => {
    const { t } = useTranslation();
    const m = t.settings.genosMemory;
    const [view, setView] = useState<View>("settings");
    const rootRef = useRef<HTMLDivElement | null>(null);
    // Set by the two buttons that switch views, so the scroll below happens
    // for a switch and never for the first mount (which would yank the
    // dialog away from its own title).
    const scrollOnSwitchRef = useRef(false);

    const switchTo = (next: View) => {
        scrollOnSwitchRef.current = true;
        setView(next);
    };

    // The dialog is the scroll container. Without this, opening the page from
    // a card near the bottom lands the reader at the bottom of the new view.
    useEffect(() => {
        if (!scrollOnSwitchRef.current) return;
        scrollOnSwitchRef.current = false;
        rootRef.current?.scrollIntoView?.({ block: "start" });
    }, [view]);

    if (view === "memory") {
        return (
            <Stack ref={rootRef} spacing={1.5} sx={{ minWidth: 0 }}>
                <Button
                    size="sm"
                    startDecorator={<ArrowBackRoundedIcon />}
                    sx={{ alignSelf: "flex-start" }}
                    variant="plain"
                    onClick={() => switchTo("settings")}
                >
                    {m.backToSettings}
                </Button>
                <Suspense
                    fallback={
                        <Box sx={{ py: 1 }}>
                            <Spinner caption={t.common.actions.loading} />
                        </Box>
                    }
                >
                    <GenosMemoryPage
                        teamId={teamId}
                        onOpenLanguageSettings={onOpenLanguageSettings}
                    />
                </Suspense>
            </Stack>
        );
    }

    return (
        <Stack ref={rootRef} spacing={2} sx={{ minWidth: 0 }}>
            {children}
            <Sheet sx={{ p: 2, borderRadius: "lg", minWidth: 0 }} variant="outlined">
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                    <PsychologyRoundedIcon />
                    <Typography level="title-md" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                        {m.entryHeading}
                    </Typography>
                </Stack>
                <Typography level="body-xs" sx={{ mb: 1.5 }}>
                    {m.entryDescription}
                </Typography>
                <Box>
                    <Button size="sm" variant="outlined" onClick={() => switchTo("memory")}>
                        {m.entryOpen}
                    </Button>
                </Box>
            </Sheet>
        </Stack>
    );
};
