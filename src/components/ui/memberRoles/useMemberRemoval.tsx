import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import PersonRemoveOutlinedIcon from "@mui/icons-material/PersonRemoveOutlined";
import { Checkbox, IconButton, Typography } from "@mui/joy";

import type { OpenWork } from "../../../features/admin/services/removeMember";
import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { canRemoveMember, MemberRole, resolveDisplayRole } from "../../../utils/memberRoles";
import { AppTooltip } from "../AppTooltip";
import { ConfirmDialog } from "../modal/ConfirmDialog";

/** A member row, as far as removal needs it. */
export type RemovableMember = {
    userId: string;
    memberRole?: string | null;
    /** What the dialog calls them. */
    name: string;
};

type Options = {
    /** Which words the dialog uses; the server rule is the same for all three. */
    kind: "team" | "project" | "chat";
    /** The name of the team, project or chat they are removed from. */
    scopeName: string;
    ownerUserId: string | null | undefined;
    /** The viewing user's own role in it, owner overlay applied. */
    myRole: MemberRole;
    myUserId: string;
    /** How much open work they hold, or `null` to skip the unassign offer (a chat). */
    loadOpenWork?: (userId: string) => Promise<OpenWork | null>;
    /** Remove them. Throw an Error with the reason to keep the dialog open and show it. */
    remove: (userId: string, unassign: boolean) => Promise<unknown>;
    /** After a success: the host updates its roster. */
    onRemoved: (userId: string) => void;
    /** Stacking for the dialog and the tooltip; must come from the host modal. */
    zIndex: number;
};

/**
 * Removing someone ELSE from a team, project or chat (MIP-1371), shared by the three profile
 * modals so they ask the same question and show the same button.
 *
 * `canRemove(member)` is the button's gate: the same rule the server enforces, so an editor
 * does not see a button on another editor or on the owner, and nobody sees one on their own
 * row. The server still decides. `button(member)` is the icon to put beside the role control;
 * `dialog` is rendered once by the modal.
 */
export const useMemberRemoval = (opts: Options) => {
    const { t } = useTranslation();
    const [target, setTarget] = useState<RemovableMember | null>(null);
    const [work, setWork] = useState<OpenWork | null>(null);
    const [loading, setLoading] = useState(false);
    const [unassign, setUnassign] = useState(true);
    const { kind } = opts;
    // Read through a ref: a host passes an inline function, and depending on it would re-run the
    // effect (and re-fetch) on every render.
    const loadRef = useRef(opts.loadOpenWork);
    loadRef.current = opts.loadOpenWork;
    const canLoad = opts.loadOpenWork != null;

    const canRemove = useCallback(
        (member: RemovableMember): boolean =>
            String(member.userId) !== String(opts.myUserId) &&
            canRemoveMember(
                opts.myRole,
                resolveDisplayRole(member.userId, opts.ownerUserId, member.memberRole)
            ),
        [opts.myRole, opts.myUserId, opts.ownerUserId]
    );

    // The unassign offer needs the person's open work; read it when the dialog opens.
    useEffect(() => {
        const load = loadRef.current;
        if (!target || !canLoad || !load) {
            setWork(null);
            setLoading(false);
            return;
        }
        let live = true;
        setWork(null);
        setLoading(true);
        setUnassign(true);
        void load(target.userId).then((w) => {
            if (!live) return;
            setWork(w);
            setLoading(false);
        });
        return () => {
            live = false;
        };
    }, [target, canLoad]);

    const m = t.common.memberRemoval;
    const title =
        kind === "team" ? m.titleTeam : kind === "project" ? m.titleProject : m.titleChat;
    const body = kind === "team" ? m.bodyTeam : kind === "project" ? m.bodyProject : m.bodyChat;
    const hasWork = work != null && (work.tasks > 0 || work.milestones > 0);

    const button = (member: RemovableMember): ReactNode =>
        canRemove(member) ? (
            <AppTooltip title={fmt(m.removeNamed, { name: member.name })}>
                <IconButton
                    aria-label={fmt(m.removeNamed, { name: member.name })}
                    color="neutral"
                    data-testid={`remove-member-${member.userId}`}
                    size="sm"
                    variant="plain"
                    sx={{ color: g.text.tertiary, "&:hover": { color: g.danger.text } }}
                    // The row is itself a button that opens the profile.
                    onClick={(e) => {
                        e.stopPropagation();
                        setTarget(member);
                    }}
                >
                    <PersonRemoveOutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </AppTooltip>
        ) : null;

    const dialog = (
        <ConfirmDialog
            open={target != null}
            cancelLabel={m.cancel}
            closeOnConfirm
            confirmLabel={m.confirm}
            description={
                target ? fmt(body, { name: target.name, scope: opts.scopeName }) : undefined
            }
            destructive
            hostZIndex={opts.zIndex}
            title={target ? fmt(title, { name: target.name, scope: opts.scopeName }) : ""}
            onClose={() => setTarget(null)}
            onConfirm={async () => {
                if (!target) return;
                await opts.remove(target.userId, hasWork && unassign);
                opts.onRemoved(target.userId);
            }}
        >
            {loading && (
                <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                    {m.loadingWork}
                </Typography>
            )}
            {hasWork && work && (
                <Checkbox
                    checked={unassign}
                    data-testid="remove-member-unassign"
                    label={m.unassign}
                    onChange={(e) => setUnassign(e.target.checked)}
                />
            )}
            {hasWork && work && (
                <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                    {fmt(m.unassignCount, { tasks: work.tasks, milestones: work.milestones })}.{" "}
                    {m.unassignHint}
                </Typography>
            )}
        </ConfirmDialog>
    );

    return { canRemove, button, dialog };
};
