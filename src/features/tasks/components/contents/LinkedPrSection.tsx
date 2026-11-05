import { Stack } from "@mui/joy";

import { useTranslation } from "../../../../i18n";
import { TaskProps } from "../../../../types/tasks";
import { LinkedPrCard } from "../../../integrations/components/LinkedPrCard";
import { parsePrUrl } from "../../../integrations/utils/parsePrUrl";
import { SectionDivider, SectionHeader } from "./PreviewSection";

/**
 * "Linked pull requests" — a rich card per PR URL found in the milestone's
 * Links list. Source of truth is `links`; there is no separate PR field.
 *
 * Only the milestone preview draws it now: a task's PRs are listed once, in its
 * Delivery block, whose PR card shows on hover (MIP-1001). The task preview
 * used to draw this section too, and the two lists disagreed (a PR merged
 * before anyone opened the preview was in Delivery but never in `links`).
 * Milestones have no Delivery block, so they keep this.
 *
 * Renders nothing — divider and header included — when no link parses as a PR
 * URL.
 */
export const LinkedPrSection = ({
    links,
    isDark,
    accessToken,
}: {
    links: TaskProps["links"] | undefined;
    isDark: boolean;
    accessToken: string | null;
}) => {
    const { t } = useTranslation();
    const prUrls = (links ?? []).map((l) => l.url).filter((u) => parsePrUrl(u) !== null);
    if (prUrls.length === 0) return null;
    return (
        <>
            <SectionDivider isDark={isDark} />
            <SectionHeader isDark={isDark}>{t.tasks.linkedPr.header}</SectionHeader>
            <Stack spacing={1}>
                {prUrls.map((url) => (
                    <LinkedPrCard key={url} accessToken={accessToken ?? ""} url={url} />
                ))}
            </Stack>
        </>
    );
};
