import { Stack } from "@mui/joy";

import { BubbleMeta } from "../../../components/ui/bubble";
import type { InboxItemProps } from "../../../types/common";
import { extractYYYYMMDDHHMM } from "../../../utils/dateUtils";
import { ReadToggleButton, UnreadDot } from "./InboxReadControls";

type Props = {
    inboxItem: InboxItemProps;
    userId: string;
    teamId: string;
    /** An activity has a read toggle; a request is read by answering it. */
    isActivity: boolean;
    /** The dot: an activity you have not looked at, a request nobody has answered yet. */
    unread: boolean;
    onChanged?: () => void;
};

/** The unread dot, the time and (activities) the read toggle, in one aligned run. */
export const InboxItemMeta = ({
    inboxItem,
    userId,
    teamId,
    isActivity,
    unread,
    onChanged,
}: Props) => (
    <Stack alignItems="center" direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
        {unread && <UnreadDot />}
        <BubbleMeta sx={{ whiteSpace: "nowrap" }}>
            {extractYYYYMMDDHHMM(inboxItem.tsSent)}
        </BubbleMeta>
        {isActivity && (
            <ReadToggleButton
                inboxItem={inboxItem}
                teamId={teamId}
                userId={userId}
                onChanged={onChanged}
            />
        )}
    </Stack>
);
