import { useState } from "react";
import { Chip, CircularProgress, Option, Select } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../i18n";
import {
    ASSIGNABLE_MEMBER_ROLES,
    MEMBER_ROLE,
    MemberRole,
    resolveDisplayRole,
} from "../../../utils/memberRoles";

type MemberRoleControlProps = {
    /** The member this control is for. */
    userId: string;
    /** The entity's owner, used to overlay the `owner` display role — the
     *  server never stores it on the member row. */
    ownerUserId: string | null | undefined;
    /** Stored role from the API (`editor` / `viewer`); may be absent on
     *  payloads that predate this feature. */
    memberRole: string | null | undefined;
    /** Whether the VIEWING user may change roles (owner or editor). */
    canManage: boolean;
    /** Persist a new role. Resolve `true` on success; on `false` the
     *  control snaps back to the previous value. */
    onChange: (userId: string, next: MemberRole) => Promise<boolean>;
    /** Layer for the Select's listbox popup. Must come from the host
     *  modal — the default page-level layer renders it BEHIND a modal. */
    popupZIndex?: number;
};

const ROLE_CHIP_COLOR: Record<MemberRole, "primary" | "success" | "neutral"> = {
    owner: "primary",
    editor: "success",
    viewer: "neutral",
};

/**
 * A member's role: a static chip for everyone, a picker for managers.
 *
 * Shared by the Team / Project / GM profile modals so the three surfaces
 * can't drift on vocabulary or on the owner-overlay rule.
 *
 * The OWNER's row always renders as a read-only chip even for managers:
 * ownership is transferred through its own owner-only flow, never by
 * editing a role here (the backend rejects it too).
 */
export const MemberRoleControl = ({
    userId,
    ownerUserId,
    memberRole,
    canManage,
    onChange,
    popupZIndex,
}: MemberRoleControlProps) => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [saving, setSaving] = useState(false);
    // Optimistic value so the picker responds instantly; reverted by the
    // `onChange` contract when the server rejects the write.
    const [override, setOverride] = useState<MemberRole | null>(null);

    const stored = resolveDisplayRole(userId, ownerUserId, memberRole);
    const current = override ?? stored;
    const label = t.common.memberRoles[current];

    const chip = (
        <Chip
            color={ROLE_CHIP_COLOR[current]}
            size="sm"
            variant="soft"
            sx={{
                borderRadius: "5px",
                fontWeight: 600,
                fontSize: "0.65rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                flexShrink: 0,
            }}
        >
            {label}
        </Chip>
    );

    if (!canManage || current === MEMBER_ROLE.owner) return chip;

    return (
        <Select
            size="sm"
            startDecorator={saving ? <CircularProgress size="sm" /> : null}
            value={current}
            variant="outlined"
            slotProps={{
                listbox: {
                    sx: { zIndex: popupZIndex },
                    onClick: (e) => e.stopPropagation(),
                },
            }}
            sx={{
                minHeight: "24px",
                minWidth: 96,
                flexShrink: 0,
                fontSize: "0.7rem",
                fontWeight: 600,
                borderRadius: "6px",
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
            }}
            // The member row is itself a button that opens the user
            // profile. Without this the picker's clicks bubble up and
            // every interaction also launches that modal.
            onClick={(e) => e.stopPropagation()}
            onChange={async (_e, value) => {
                if (!value || value === current) return;
                const next = value as MemberRole;
                const previous = current;
                setOverride(next);
                setSaving(true);
                const ok = await onChange(userId, next);
                setSaving(false);
                if (!ok) setOverride(previous);
            }}
        >
            {ASSIGNABLE_MEMBER_ROLES.map((role) => (
                <Option key={role} value={role}>
                    {t.common.memberRoles[role]}
                </Option>
            ))}
        </Select>
    );
};
