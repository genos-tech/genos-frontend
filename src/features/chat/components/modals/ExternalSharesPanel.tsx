/**
 * "Teams in this chat" — the cross-team section of an external GM.
 *
 * Thin on purpose: the layout and the host/guest asymmetry live in the
 * shared `ObjectSharesPanel`, which projects and note folders render too.
 * What is chat-specific is only *how* a roster change is written — through
 * `channelService`, so the socket layer broadcasts it and the other team's
 * open window updates, rather than through the grant endpoints directly.
 */
import { useCallback, useEffect, useState } from "react";

import { ObjectSharesPanel } from "../../../../components/ui/sharing/ObjectSharesPanel";
import { useAuth } from "../../../../context/AuthContext";
import { useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { ChannelKind, type ChannelShare } from "../../../../types/channel";
import { fetchOwnTeamRoster, revokeExternalShare } from "../../../admin/services/teamConnections";

type Props = {
    channelId: string;
    /** The current user, so the picker can skip them and their own row. */
    myUserId: string;
    labelColor: string;
    valueColor: string;
    borderColor: string;
};

export const ExternalSharesPanel = ({
    channelId,
    myUserId,
    labelColor,
    valueColor,
    borderColor,
}: Props) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();

    const [shares, setShares] = useState<ChannelShare[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            setShares(await channelService.fetchChannelShares(channelId));
        } catch {
            // A chat that turns out not to be shared and a failed fetch
            // look the same here; this section is never why the modal was
            // opened, so it stays quiet and empty.
            setShares([]);
        }
    }, [channelId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch {
            setError(t.common.externalShares.actionFailed);
        }
        setBusy(false);
        await refresh();
    };

    if (shares.length === 0) return null;

    return (
        <ObjectSharesPanel
            borderColor={borderColor}
            busy={busy}
            error={error}
            labelColor={labelColor}
            myUserId={myUserId}
            rosterFor={(teamId) => fetchOwnTeamRoster(accessToken, teamId)}
            shares={shares}
            valueColor={valueColor}
            onAdmit={(_share, userId) => run(() => channelService.addMembers(channelId, [userId]))}
            onRevoke={(share) =>
                run(() => revokeExternalShare(accessToken, share.grantId, setError))
            }
            onWithdraw={(_share, userId) =>
                run(() => channelService.removeMember(channelId, ChannelKind.GM, userId))
            }
        />
    );
};
