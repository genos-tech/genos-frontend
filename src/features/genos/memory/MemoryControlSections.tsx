import { Sheet } from "@mui/joy";

import { ErrorState } from "../../../components/ui/feedback/ErrorState";
import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { useTranslation } from "../../../i18n";
import { MemoryDeleteSection } from "./MemoryDeleteSection";
import { MemoryNoticedSection } from "./MemoryNoticedSection";
import { MemoryStoredSection } from "./MemoryStoredSection";
import { MemoryTuningSection } from "./MemoryTuningSection";
import { useMemoryControl } from "./useMemoryControl";

interface Props {
    accessToken: string | null;
    teamId: string;
    // Bumped by the page when the recording switch above changes (turning it off deletes
    // everything), so what is shown here is read again.
    refreshKey: number;
}

/**
 * The member's own controls over what Genos remembers about their work (MIP-1088), in four
 * sections that share one request and one piece of local state: what is stored, what Genos
 * noticed, how it weighs things, and delete. They sit under the "Note my activity" switch, which
 * is the one place recording is paused (it is not repeated here).
 */
export const MemoryControlSections = ({ accessToken, teamId, refreshKey }: Props) => {
    const { t } = useTranslation();
    const m = t.settings.genosMemory.control.stored;
    const control = useMemoryControl({ accessToken, teamId, refreshKey });

    if (control.status !== "ready" || !control.overview) {
        return (
            <Sheet sx={{ p: 2, borderRadius: "lg", minWidth: 0 }} variant="outlined">
                {control.status === "loading" ? (
                    <SkeletonRows count={3} label={m.loading} />
                ) : (
                    <ErrorState
                        data-error="genos-memory-control"
                        size="xs"
                        title={m.loadFailed}
                        onRetry={control.reload}
                    />
                )}
            </Sheet>
        );
    }

    const { overview } = control;
    return (
        <>
            <MemoryStoredSection overview={overview} />
            <MemoryNoticedSection
                clearMark={control.clearMark}
                loadTop={control.loadTop}
                mark={control.mark}
                overview={overview}
                stale={control.stale}
                top={control.top}
            />
            <MemoryTuningSection
                overview={overview}
                resetTuning={control.resetTuning}
                setLevel={control.setLevel}
            />
            <MemoryDeleteSection remove={control.remove} />
        </>
    );
};
