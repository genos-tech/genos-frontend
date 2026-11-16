import AllInboxRoundedIcon from "@mui/icons-material/AllInboxRounded";
import { Stack } from "@mui/joy";
import { useLocation } from "react-router-dom";

import { PageHeader } from "../../../components/ui/page/PageHeader";
import { useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import type { UserProps } from "../../../types/admin";
import type { InboxItemProps } from "../../../types/common";
import { InboxMarkAllReadButton } from "./InboxMarkAllReadButton";
import { InboxSyncButton } from "./InboxSyncButton";

type InboxHeaderProps = {
    activityItems: InboxItemProps[];
    myself: UserProps;
    /** Re-read the list after a bulk change. */
    onItemsChanged: () => void;
};

/** The Inbox's page header: the shared bar, with its icon and one line of context. */
export const InboxHeader = ({ activityItems, myself, onItemsChanged }: InboxHeaderProps) => {
    const { t } = useTranslation();
    const location = useLocation();
    // "Mark all as read" only ever touches the Activities half, so it is offered there and
    // nowhere else: on Requests it would read as clearing the requests.
    const onActivities = location.pathname.includes("/activities");

    return (
        <PageHeader
            data-testid="inbox-header"
            leading={<AllInboxRoundedIcon sx={{ fontSize: 20, color: g.text.secondary }} />}
            subtitle={t.inbox.header.subtitle}
            title={t.inbox.header.title}
            actions={
                <Stack alignItems="center" direction="row" spacing={0.5}>
                    {onActivities && (
                        <InboxMarkAllReadButton
                            items={activityItems}
                            myself={myself}
                            onChanged={onItemsChanged}
                        />
                    )}
                    <InboxSyncButton />
                </Stack>
            }
        />
    );
};
