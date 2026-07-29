import { purplePalette } from "../../../theme/purplePalette";

// All UI surface styles flow through `purplePalette` (see
// `src/theme/purplePalette.ts`). Functional/data colors — task status,
// priority flags, the tag picker, the online-status indicator — intentionally
// bypass this file. Public field names are preserved so existing consumers
// don't need to be touched.

const { dark: D, light: L } = purplePalette;

/**
 * Stacking layer of the profile-modal family (user / team / project / GM).
 *
 * Exported so anything opened FROM one of those modals can derive its own
 * layer (`PROFILE_MODAL_Z_INDEX + 1`) instead of hardcoding a number that
 * silently sinks behind its host — which is exactly what happened to the
 * add-members picker: it carried a fixed 10000 from its page-level
 * callers, so hosting it inside a profile modal rendered it underneath.
 * See `frontend z-index` notes: derive from the host, never hardcode.
 */
export const PROFILE_MODAL_Z_INDEX = 10001;

export const SignUpFormStyles = {
    dark: {
        cardBg: D.surface,
        cardBorder: D.border,
        cardShadow: D.shadow,
        inputBg: D.inputBg,
        inputBorder: D.inputBorder,
        inputFocusBorder: D.inputFocusBorder,
        inputFocusShadow: D.inputFocusShadow,
        labelColor: D.textMuted,
        titleGradient: D.titleGradient,
        buttonBg: D.primaryButtonBg,
        buttonHover: D.primaryButtonHover,
        buttonShadow: D.primaryButtonShadow,
        linkColor: D.accentSoft,
        linkHover: D.accent,
        accentColor: D.accentSoft,
        accentColorRgb: D.accentSoftRgb,
        textColor: D.text,
        subtitleColor: D.textMuted,
    },
    light: {
        cardBg: L.surface,
        cardBorder: L.border,
        cardShadow: L.shadow,
        inputBg: L.inputBg,
        inputBorder: L.inputBorder,
        inputFocusBorder: L.inputFocusBorder,
        inputFocusShadow: L.inputFocusShadow,
        labelColor: L.textMuted,
        titleGradient: L.titleGradient,
        buttonBg: L.primaryButtonBg,
        buttonHover: L.primaryButtonHover,
        buttonShadow: L.primaryButtonShadow,
        linkColor: L.accent,
        linkHover: L.accentStrong,
        accentColor: L.accent,
        accentColorRgb: L.accentRgb,
        textColor: L.text,
        subtitleColor: L.textMuted,
    },
};

export const SignInFormStyles = {
    dark: {
        cardBg: D.surface,
        cardBorder: D.border,
        cardShadow: D.shadow,
        inputBg: D.inputBg,
        inputBorder: D.inputBorder,
        inputFocusBorder: D.inputFocusBorder,
        inputFocusShadow: D.inputFocusShadow,
        labelColor: D.textMuted,
        titleGradient: D.titleGradient,
        buttonBg: D.primaryButtonBg,
        buttonHover: D.primaryButtonHover,
        buttonShadow: D.primaryButtonShadow,
        linkColor: D.accentSoft,
        linkHover: D.accent,
        accentColor: D.accentSoft,
        accentColorRgb: D.accentSoftRgb,
        textColor: D.text,
        subtitleColor: D.textMuted,
    },
    light: {
        cardBg: L.surface,
        cardBorder: L.border,
        cardShadow: L.shadow,
        inputBg: L.inputBg,
        inputBorder: L.inputBorder,
        inputFocusBorder: L.inputFocusBorder,
        inputFocusShadow: L.inputFocusShadow,
        labelColor: L.textMuted,
        titleGradient: L.titleGradient,
        buttonBg: L.primaryButtonBg,
        buttonHover: L.primaryButtonHover,
        buttonShadow: L.primaryButtonShadow,
        linkColor: L.accent,
        linkHover: L.accentStrong,
        accentColor: L.accent,
        accentColorRgb: L.accentRgb,
        textColor: L.text,
        subtitleColor: L.textMuted,
    },
};

export const JoinTeamFormStyles = {
    dark: {
        cardBg: D.surface,
        cardBorder: D.border,
        cardShadow: D.shadow,
        inputBg: D.inputBg,
        inputBorder: D.inputBorder,
        inputFocusBorder: D.inputFocusBorder,
        inputFocusShadow: D.inputFocusShadow,
        labelColor: D.textMuted,
        titleGradient: D.titleGradient,
        sectionTitleColor: D.accentSoft,
        buttonBg: D.primaryButtonBg,
        buttonHover: D.primaryButtonHover,
        buttonShadow: D.primaryButtonShadow,
        secondaryButtonBg: D.buttonBg,
        secondaryButtonBorder: D.buttonBorder,
        secondaryButtonHover: D.buttonBgHover,
        linkColor: D.accentSoft,
        linkHover: D.accent,
        accentColor: D.accentSoft,
        accentColorRgb: D.accentSoftRgb,
        textColor: D.text,
        subtitleColor: D.textMuted,
        listItemBg: "rgba(var(--gp-brand-700-rgb), 0.05)",
        listItemBorder: "rgba(var(--gp-brand-700-rgb), 0.1)",
        listItemHover: D.hoverBg,
        successBg: D.successTintBg,
        successBorder: D.successTintBorder,
        successText: D.successTint,
    },
    light: {
        cardBg: L.surface,
        cardBorder: L.border,
        cardShadow: L.shadow,
        inputBg: L.inputBg,
        inputBorder: L.inputBorder,
        inputFocusBorder: L.inputFocusBorder,
        inputFocusShadow: L.inputFocusShadow,
        labelColor: L.textMuted,
        titleGradient: L.titleGradient,
        sectionTitleColor: L.accent,
        buttonBg: L.primaryButtonBg,
        buttonHover: L.primaryButtonHover,
        buttonShadow: L.primaryButtonShadow,
        secondaryButtonBg: L.buttonBg,
        secondaryButtonBorder: L.buttonBorder,
        secondaryButtonHover: L.buttonBgHover,
        linkColor: L.accent,
        linkHover: L.accentStrong,
        accentColor: L.accent,
        accentColorRgb: L.accentRgb,
        textColor: L.text,
        subtitleColor: L.textMuted,
        listItemBg: "rgba(var(--gp-brand-700-rgb), 0.03)",
        listItemBorder: "rgba(var(--gp-brand-700-rgb), 0.08)",
        listItemHover: L.hoverBg,
        successBg: L.successTintBg,
        successBorder: L.successTintBorder,
        successText: L.successTint,
    },
};

export const ActionButtonStyles = {
    dark: {
        containerBg: D.surfaceElevated,
        containerBorder: D.border,
        titleGradient: D.titleGradient,
        buttonBg: D.buttonBg,
        buttonHover: D.buttonBgHover,
        buttonBorder: D.buttonBorder,
        createButtonBg: D.primaryButtonBg,
        createButtonHover: D.primaryButtonHover,
        dangerBg: D.dangerTintBg,
        dangerHover: D.dangerTintBgHover,
        dangerBorder: D.dangerTintBorder,
        menuBg: D.menuBg,
        menuBorder: D.menuBorder,
        textColor: D.text,
        mutedText: D.textMuted,
        lockColor: D.warningTint,
    },
    light: {
        containerBg: L.surfaceElevated,
        containerBorder: L.border,
        titleGradient: L.titleGradient,
        buttonBg: L.buttonBg,
        buttonHover: L.buttonBgHover,
        buttonBorder: L.buttonBorder,
        createButtonBg: L.primaryButtonBg,
        createButtonHover: L.primaryButtonHover,
        dangerBg: L.dangerTintBg,
        dangerHover: L.dangerTintBgHover,
        dangerBorder: L.dangerTintBorder,
        menuBg: L.menuBg,
        menuBorder: L.menuBorder,
        textColor: L.text,
        mutedText: L.textMuted,
        lockColor: L.warningTint,
    },
};

export const HeaderStyles = {
    dark: {
        logoBg: D.primaryButtonBg,
        logoShadow: D.shadowSoft,
        titleGradient: D.titleGradient,
        subtitleColor: D.textMuted,
        containerBg: "rgba(var(--gp-dark-surface-b-rgb), 0.6)",
        containerBorder: D.border,
        starColor: D.warningTint,
    },
    light: {
        logoBg: L.primaryButtonBg,
        logoShadow: L.shadowSoft,
        titleGradient: L.titleGradient,
        subtitleColor: L.textMuted,
        containerBg: "rgba(255,255,255,0.7)",
        containerBorder: L.border,
        starColor: L.warningTint,
    },
};

export const HeaderUserNameStyles = {
    dark: {
        avatarBg: D.hoverBg,
        avatarBorder: D.border,
        chipBg: D.chipBg,
        chipBorder: D.chipBorder,
        // Functional: online/offline indicator hues bypass the purple ramp.
        onlineColor: "#22c55e",
        offlineColor: "#6b7280",
        lockBg: D.warningTintBg,
        lockBorder: D.warningTintBorder,
        lockColor: D.warningTint,
        textColor: D.text,
        subtitleColor: D.textMuted,
    },
    light: {
        avatarBg: L.hoverBg,
        avatarBorder: L.border,
        chipBg: L.chipBg,
        chipBorder: L.chipBorder,
        onlineColor: "#16a34a",
        offlineColor: "#9ca3af",
        lockBg: L.warningTintBg,
        lockBorder: L.warningTintBorder,
        lockColor: L.warningTint,
        textColor: L.text,
        subtitleColor: L.textMuted,
    },
};

export const ChatPaneHeaderStyles = {
    dark: {
        containerBg: D.surface,
        containerBorder: D.border,
        buttonBg: D.buttonBg,
        buttonHover: D.buttonBgHover,
        buttonBorder: D.buttonBorder,
        primaryButtonBg: D.primaryButtonBg,
        primaryButtonHover: D.primaryButtonHover,
        dangerBg: D.dangerTintBg,
        dangerHover: D.dangerTintBgHover,
        dangerBorder: D.dangerTintBorder,
        accentColor: D.accentSoft,
        accentColorRgb: D.accentSoftRgb,
        glowColor: D.glow,
    },
    light: {
        containerBg: L.surface,
        containerBorder: L.border,
        buttonBg: L.buttonBg,
        buttonHover: L.buttonBgHover,
        buttonBorder: L.buttonBorder,
        primaryButtonBg: L.primaryButtonBg,
        primaryButtonHover: L.primaryButtonHover,
        dangerBg: L.dangerTintBg,
        dangerHover: L.dangerTintBgHover,
        dangerBorder: L.dangerTintBorder,
        accentColor: L.accent,
        accentColorRgb: L.accentRgb,
        glowColor: L.glow,
    },
};

export const ThreadChatPaneHeaderStyles = {
    dark: {
        containerBg: D.surface,
        containerBorder: D.border,
        buttonBg: D.buttonBg,
        buttonHover: D.buttonBgHover,
        buttonBorder: D.buttonBorder,
        primaryButtonBg: D.primaryButtonBg,
        primaryButtonHover: D.primaryButtonHover,
        dangerBg: D.dangerTintBg,
        dangerHover: D.dangerTintBgHover,
        dangerBorder: D.dangerTintBorder,
        chipBg: D.chipBg,
        chipBorder: D.chipBorder,
        threadBadgeBg: D.primaryButtonBg,
        accentColor: D.accentSoft,
        accentColorRgb: D.accentSoftRgb,
        textColor: D.text,
        glowColor: D.glow,
    },
    light: {
        containerBg: L.surface,
        containerBorder: L.border,
        buttonBg: L.buttonBg,
        buttonHover: L.buttonBgHover,
        buttonBorder: L.buttonBorder,
        primaryButtonBg: L.primaryButtonBg,
        primaryButtonHover: L.primaryButtonHover,
        dangerBg: L.dangerTintBg,
        dangerHover: L.dangerTintBgHover,
        dangerBorder: L.dangerTintBorder,
        chipBg: L.chipBg,
        chipBorder: L.chipBorder,
        threadBadgeBg: L.primaryButtonBg,
        accentColor: L.accent,
        accentColorRgb: L.accentRgb,
        textColor: L.text,
        glowColor: L.glow,
    },
};

export const NoteHeaderActionsStyles = {
    dark: {
        containerBg: D.surfaceElevated,
        containerBorder: D.border,
        buttonBg: D.buttonBg,
        buttonHover: D.buttonBgHover,
        buttonBorder: D.buttonBorder,
        primaryButtonBg: D.primaryButtonBg,
        primaryButtonHover: D.primaryButtonHover,
        dangerBg: D.dangerTintBg,
        dangerHover: D.dangerTintBgHover,
        dangerBorder: D.dangerTintBorder,
        menuBg: D.menuBg,
        menuBorder: D.menuBorder,
        textColor: D.text,
        accentColor: D.accentSoft,
        accentColorRgb: D.accentSoftRgb,
        glowColor: D.glow,
        chipBg: "rgba(var(--gp-brand-700-rgb), 0.15)",
        chipBorder: D.chipBorder,
        avatarBg: D.hoverBg,
        avatarBorder: D.border,
    },
    light: {
        containerBg: L.surfaceElevated,
        containerBorder: L.border,
        buttonBg: L.buttonBg,
        buttonHover: L.buttonBgHover,
        buttonBorder: L.buttonBorder,
        primaryButtonBg: L.primaryButtonBg,
        primaryButtonHover: L.primaryButtonHover,
        dangerBg: L.dangerTintBg,
        dangerHover: L.dangerTintBgHover,
        dangerBorder: L.dangerTintBorder,
        menuBg: L.menuBg,
        menuBorder: L.menuBorder,
        textColor: L.text,
        accentColor: L.accent,
        accentColorRgb: L.accentRgb,
        glowColor: L.glow,
        chipBg: "rgba(var(--gp-brand-700-rgb), 0.1)",
        chipBorder: L.chipBorder,
        avatarBg: L.hoverBg,
        avatarBorder: L.border,
    },
};

export const TaskHeaderStyles = {
    dark: {
        containerBg: D.surfaceElevated,
        containerBorder: D.border,
        titleGradient: D.titleGradient,
        buttonBg: D.buttonBg,
        buttonHover: D.buttonBgHover,
        buttonBorder: D.buttonBorder,
        createButtonBg: D.primaryButtonBg,
        createButtonHover: D.primaryButtonHover,
        dangerBg: D.dangerTintBg,
        dangerHover: D.dangerTintBgHover,
        dangerBorder: D.dangerTintBorder,
        menuBg: D.menuBg,
        menuBorder: D.menuBorder,
        textColor: D.text,
        mutedText: D.textMuted,
        lockColor: D.warningTint,
    },
    light: {
        containerBg: L.surfaceElevated,
        containerBorder: L.border,
        titleGradient: L.titleGradient,
        buttonBg: L.buttonBg,
        buttonHover: L.buttonBgHover,
        buttonBorder: L.buttonBorder,
        createButtonBg: L.primaryButtonBg,
        createButtonHover: L.primaryButtonHover,
        dangerBg: L.dangerTintBg,
        dangerHover: L.dangerTintBgHover,
        dangerBorder: L.dangerTintBorder,
        menuBg: L.menuBg,
        menuBorder: L.menuBorder,
        textColor: L.text,
        mutedText: L.textMuted,
        lockColor: L.warningTint,
    },
};

export const ProfileModalStyles = {
    dark: {
        bg: D.surface,
        cardBg: D.surfaceElevated,
        border: D.border,
        shadow: D.shadow,
        headerGradient: D.titleGradient,
        labelColor: D.textMuted,
        valueColor: D.text,
        hoverBg: D.hoverBg,
        avatarGlow:
            "0 0 40px rgba(var(--gp-brand-700-rgb), 0.4), 0 0 80px rgba(var(--gp-brandalt-500-rgb), 0.2)",
        accentColor: D.accentSoft,
        accentColorRgb: D.accentSoftRgb,
        inputBg: "rgba(var(--gp-dark-surface-b-rgb), 0.95)",
    },
    light: {
        bg: L.surface,
        cardBg: L.surfaceElevated,
        border: L.border,
        shadow: L.shadow,
        headerGradient: L.titleGradient,
        labelColor: L.textMuted,
        valueColor: L.text,
        hoverBg: L.hoverBg,
        avatarGlow:
            "0 0 40px rgba(var(--gp-brand-700-rgb), 0.2), 0 0 80px rgba(var(--gp-brandalt-500-rgb), 0.1)",
        accentColor: L.accent,
        accentColorRgb: L.accentRgb,
        inputBg: "rgba(255,255,255,0.95)",
    },
};

export const TeamDropdownStyles = {
    dark: {
        avatarBorder: "rgba(var(--gp-brand-700-rgb), 0.4)",
        avatarShadow: "0 2px 12px rgba(var(--gp-brand-700-rgb), 0.3)",
        avatarHoverShadow: "0 4px 20px rgba(var(--gp-brand-700-rgb), 0.5)",
        menuBg: D.menuBg,
        menuBorder: D.borderStrong,
        menuShadow: D.shadow,
        menuItemHover: D.hoverBg,
        menuItemActive: D.chipBg,
        iconColor: D.accentSoft,
        iconColorRgb: D.accentSoftRgb,
        textColor: D.text,
        subtitleColor: D.textMuted,
        accentGradient: D.accentGradient,
        // "Currently selected team" indicator — decorative, not data.
        successColor: D.accentSoft,
        dividerColor: D.divider,
    },
    light: {
        avatarBorder: "rgba(var(--gp-brand-700-rgb), 0.3)",
        avatarShadow: "0 2px 12px rgba(var(--gp-brand-700-rgb), 0.15)",
        avatarHoverShadow: "0 4px 20px rgba(var(--gp-brand-700-rgb), 0.3)",
        menuBg: L.menuBg,
        menuBorder: L.border,
        menuShadow: L.shadow,
        menuItemHover: L.hoverBg,
        menuItemActive: L.chipBg,
        iconColor: L.accent,
        iconColorRgb: L.accentRgb,
        textColor: L.text,
        subtitleColor: L.textMuted,
        accentGradient: L.accentGradient,
        successColor: L.accent,
        dividerColor: L.divider,
    },
};

export const TaskFilterMenuStyles = {
    dark: {
        containerBg: D.surfaceElevated,
        containerBorder: D.border,
        buttonBg: "rgba(var(--gp-dark-surface-c-rgb), 0.8)",
        buttonHoverBg: D.hoverBg,
        menuBg: D.menuBg,
        menuBorder: D.menuBorder,
        textColor: D.text,
        mutedText: D.textMuted,
        resetBg: D.dangerTintBg,
        resetHover: D.dangerTintBgHover,
        resetBorder: D.dangerTintBorder,
    },
    light: {
        containerBg: L.surfaceElevated,
        containerBorder: L.border,
        buttonBg: "rgba(255,255,255,0.9)",
        buttonHoverBg: L.hoverBg,
        menuBg: L.menuBg,
        menuBorder: L.menuBorder,
        textColor: L.text,
        mutedText: L.textMuted,
        resetBg: L.dangerTintBg,
        resetHover: L.dangerTintBgHover,
        resetBorder: L.dangerTintBorder,
    },
};

// Shared layout style tokens applied to the top-level Shell of each service
// Home (chat, tasks, notes, inbox). Consumers pick dark or light based on
// `useColorScheme()`, then spread the relevant sub-object into their sx prop.
export const LayoutStyles = {
    // Mode-independent: the outermost Box every Home renders.
    // On mobile we reserve room for the BottomTabBar (position: fixed,
    // bottom: 0) by capping the wrapper at viewport-minus-tab-bar so
    // the feature content ends above the tab bar instead of being
    // covered by it.
    // `--mobile-bottom-inset` is the tab bar, or the on-screen keyboard
    // when that's taller (see index.css). Subtracting it means the
    // composer at the bottom of a chat surface rides above the keyboard
    // instead of sitting behind it — iOS never shrinks the viewport for
    // the keyboard, so without this the input is simply covered.
    outerWrapper: {
        display: "flex",
        minHeight: {
            xs: "calc(100dvh - var(--mobile-bottom-inset, 60px))",
            md: "100dvh",
        },
        height: {
            xs: "calc(100dvh - var(--mobile-bottom-inset, 60px))",
            md: "auto",
        },
        flex: 1,
        minWidth: 0,
    } as const,

    dark: {
        // Ambient gradient surface — applied to the Sheet that wraps each service's content
        serviceSurface: {
            flex: 1,
            display: "flex",
            flexDirection: "column" as const,
            background:
                "linear-gradient(180deg, rgba(var(--gp-dark-surface-b-rgb), 1) 0%, rgba(11,10,22,1) 100%)",
            position: "relative" as const,
            overflow: "hidden" as const,
        },

        // Subtle radial glow decorations (position: absolute, pointerEvents: none)
        decorTopRight: {
            position: "absolute" as const,
            top: 0,
            right: 0,
            width: "50%",
            height: "60%",
            pointerEvents: "none" as const,
            background:
                "radial-gradient(ellipse at top right, rgba(var(--gp-brand-700-rgb), 0.06) 0%, transparent 60%)",
        },
        decorBottomLeft: {
            position: "absolute" as const,
            bottom: 0,
            left: 0,
            width: "40%",
            height: "40%",
            pointerEvents: "none" as const,
            background:
                "radial-gradient(ellipse at bottom left, rgba(var(--gp-brandalt-500-rgb), 0.04) 0%, transparent 60%)",
        },

        // Box that wraps a sidebar Panel (the left resizable column)
        sidebarPanel: {
            height: "100%",
            width: "100%",
            borderRight: "1px solid",
            borderColor: D.border,
        },

        // Box that wraps a main content Panel (right-side resizable column with header offset)
        mainPanel: {
            px: { xs: 1, md: 2 },
            pt: {
                xs: "calc(12px + var(--Header-height))",
                sm: "calc(12px + var(--Header-height))",
                md: 3,
            },
            pb: { xs: 2, sm: 2, md: 3 },
            flex: 1,
            display: "flex",
            flexDirection: "column" as const,
            minWidth: 0,
            height: "100dvh",
            overflow: "hidden" as const,
            gap: 1,
            borderRight: "1px solid",
            borderColor: D.border,
        },
    },

    light: {
        serviceSurface: {
            flex: 1,
            display: "flex",
            flexDirection: "column" as const,
            background:
                "linear-gradient(180deg, rgba(252,250,255,1) 0%, rgba(248,245,255,1) 100%)",
            position: "relative" as const,
            overflow: "hidden" as const,
        },

        decorTopRight: {
            position: "absolute" as const,
            top: 0,
            right: 0,
            width: "50%",
            height: "60%",
            pointerEvents: "none" as const,
            background:
                "radial-gradient(ellipse at top right, rgba(var(--gp-brand-700-rgb), 0.04) 0%, transparent 60%)",
        },
        decorBottomLeft: {
            position: "absolute" as const,
            bottom: 0,
            left: 0,
            width: "40%",
            height: "40%",
            pointerEvents: "none" as const,
            background:
                "radial-gradient(ellipse at bottom left, rgba(var(--gp-brand-700-rgb), 0.03) 0%, transparent 60%)",
        },

        sidebarPanel: {
            height: "100%",
            width: "100%",
            borderRight: "1px solid",
            borderColor: L.border,
        },

        mainPanel: {
            px: { xs: 1, md: 2 },
            pt: {
                xs: "calc(12px + var(--Header-height))",
                sm: "calc(12px + var(--Header-height))",
                md: 3,
            },
            pb: { xs: 2, sm: 2, md: 3 },
            flex: 1,
            display: "flex",
            flexDirection: "column" as const,
            minWidth: 0,
            height: "100dvh",
            overflow: "hidden" as const,
            gap: 1,
            borderRight: "1px solid",
            borderColor: L.border,
        },
    },
} as const;
