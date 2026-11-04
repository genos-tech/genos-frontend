import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TaskProps } from "../../../../types/tasks";
import { parsePrUrl } from "../../../integrations/utils/parsePrUrl";
import { useFinishedPrDeliveries } from "../../hooks/useFinishedPrDeliveries";
import { LinkedPrCards } from "./LinkedPrCards";
import { SectionDivider, SectionHeader } from "./PreviewSection";

/**
 * "Linked pull requests" — a rich card per PR URL found in the entity's
 * Links list. Source of truth is `links`; there is no separate PR field.
 *
 * Shared by the task branch and `MilestonePreviewInner`. It lived inline
 * in the task branch only, so a milestone's PRs never rendered even
 * though milestones carry `links` exactly like tasks do (the create form
 * forwards them, and `DynamicURLManager` edits them in both previews).
 * Extracted rather than copied so the two panes can't drift again.
 *
 * Renders nothing — divider and header included — when no link parses as
 * a PR URL, so a task with only non-GitHub links is unaffected.
 *
 * With `taskId` (the task branch), a PR the task's deliveries say is merged or
 * closed is a one-line row that fetches its detail on hover instead of a full
 * card that fetches at mount (MIP-998): a task with a dozen merged PRs used to
 * send a dozen GitHub-backed requests the moment it opened. The section waits
 * for the deliveries before it draws, since drawing full cards first would send
 * those requests anyway. Without `taskId` (the milestone preview) every PR
 * keeps its full card.
 */
export const LinkedPrSection = ({
    links,
    isDark,
    accessToken,
    myself,
    taskId,
}: {
    links: TaskProps["links"] | undefined;
    isDark: boolean;
    accessToken: string | null;
    myself: UserProps;
    taskId?: number | null;
}) => {
    const { t } = useTranslation();
    const prUrls = (links ?? []).map((l) => l.url).filter((u) => parsePrUrl(u) !== null);
    const finished = useFinishedPrDeliveries(myself, accessToken, taskId, prUrls.length > 0);
    if (prUrls.length === 0 || finished === null) return null;
    return (
        <>
            <SectionDivider isDark={isDark} />
            <SectionHeader isDark={isDark}>{t.tasks.linkedPr.header}</SectionHeader>
            <LinkedPrCards accessToken={accessToken ?? ""} finished={finished} urls={prUrls} />
        </>
    );
};
