import { lazy, Suspense } from "react";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import { CircularProgress, IconButton, Modal, ModalClose, ModalDialog, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UseTodoGroupsState } from "../../hooks/useTodoGroups";
import { useTranslation } from "../../i18n";
import { g } from "../../theme/tokens";
import { UserProps } from "../../types/admin";
import { ModalTarget } from "../../utils/parseInternalUrl";
import { AppTooltip } from "../ui/AppTooltip";

// Lazy on purpose: these views transitively import the chat panes,
// task preview and note editor — the whole BlockNote stack (~900 kB
// gzipped vendor-editor chunk). UrlLinkModal itself is imported
// eagerly by App, so static view imports would pin all of that into
// the initial entry chunk even though a view only ever renders after
// the user clicks an internal link.
const ModalChatView = lazy(() =>
    import("./views/ModalChatView").then((m) => ({ default: m.ModalChatView }))
);
const ModalMilestoneView = lazy(() =>
    import("./views/ModalMilestoneView").then((m) => ({ default: m.ModalMilestoneView }))
);
const ModalNoteView = lazy(() =>
    import("./views/ModalNoteView").then((m) => ({ default: m.ModalNoteView }))
);
const ModalTaskView = lazy(() =>
    import("./views/ModalTaskView").then((m) => ({ default: m.ModalTaskView }))
);
const ModalTodoView = lazy(() =>
    import("./views/ModalTodoView").then((m) => ({ default: m.ModalTodoView }))
);

const ViewLoadingFallback = () => (
    <Stack sx={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
        <CircularProgress size="md" />
    </Stack>
);

// Shared look for chrome that floats over whichever view is mounted: a flat
// raised chip with one thin line, so it stays legible against the header (or
// the content) scrolling underneath it, in both color schemes (tokens switch
// with the mode; a hardcoded white-on-white once made the X vanish in dark).
const floatingChromeSx = {
    zIndex: 2,
    backgroundColor: g.surface.raised,
    border: `1px solid ${g.border.default}`,
    color: g.text.secondary,
    "&:hover": {
        backgroundColor: g.hover,
        color: g.text.primary,
    },
} as const;

type UrlLinkModalProps = {
    target: ModalTarget | null;
    onClose: () => void;
    // Swap this preview for the target's own page. Rendered as a button
    // beside the ✕ when present, and absent for previews whose opener
    // didn't supply one (a link clicked in a chat message: the user is
    // reading that chat and the link itself is the way to the page).
    // It's the discoverable twin of ⌘/Ctrl-clicking a Spotlight result,
    // which skips the preview and navigates outright.
    onOpenFullPage?: () => void;
    accessToken: string | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useNM: NoteManagementState;
    useSM?: SprintMilestoneManagementState;
    useTG: UseTodoGroupsState;
    // Stacking override. Defaults to 10020, the chat-message link case.
    // The Spotlight overlay sits at 13100, so the preview opened from a
    // citation inside an answer must pass a higher value (e.g. 13200)
    // to render above the Spotlight sheet.
    zIndex?: number;
};

// Global preview modal for internal links clicked inside chat messages.
// MUI Joy's Modal handles click-outside-to-close and Escape natively
// via `onClose`. Sizing is viewport-relative so the dialog stays usable
// on a wide range of screen sizes without overflowing.
export const UrlLinkModal = (props: UrlLinkModalProps) => {
    const { t } = useTranslation();
    const { target, onClose, onOpenFullPage, zIndex, useTG, ...rest } = props;
    const effectiveZIndex = zIndex ?? 10020;
    // A task / milestone preview on a phone takes the whole screen. As a
    // centred card (88vh x 92vw, 20px corners) it left a strip of backdrop above
    // and below it and 20px at each side, on a screen that has none to spare.
    // The other views (chat, notes, to-do) keep the card.
    const isMobile = useIsMobile();
    const fullScreen = isMobile && (target?.kind === "task" || target?.kind === "milestone");

    const renderBody = () => {
        if (!target) return null;
        if (target.kind === "chatMain" || target.kind === "chatThread") {
            // `hostZIndex` lets the thread header lift its MoreMenu +
            // ThreadAskModal above this dialog (they portal to body at
            // layers below it otherwise).
            return <ModalChatView hostZIndex={effectiveZIndex} target={target} {...rest} />;
        }
        if (target.kind === "task") {
            // `hostZIndex` tells the preview it's modal-hosted (header
            // actions adapt) and what layer overlays it spawns (the task
            // diagram) must stack above — see diagramZIndex.ts.
            return (
                <ModalTaskView
                    hostZIndex={effectiveZIndex}
                    target={target}
                    onClose={onClose}
                    {...rest}
                />
            );
        }
        if (target.kind === "milestone") {
            return (
                <ModalMilestoneView
                    hostZIndex={effectiveZIndex}
                    target={target}
                    onClose={onClose}
                    {...rest}
                />
            );
        }
        if (target.kind === "todo") {
            // Narrower prop set than the other views on purpose — the
            // todo pane renders against the shared useTG, not the
            // task/project/note management states.
            return (
                <ModalTodoView
                    accessToken={rest.accessToken}
                    hostZIndex={effectiveZIndex}
                    myself={rest.myself}
                    setMyself={rest.setMyself}
                    socket={rest.socket}
                    target={target}
                    useCM={rest.useCM}
                    useTEM={rest.useTEM}
                    useTG={useTG}
                    useUISM={rest.useUISM}
                    onClose={onClose}
                />
            );
        }
        if (
            target.kind === "myNote" ||
            target.kind === "sharedNote" ||
            target.kind === "teamNote" ||
            target.kind === "taskNote" ||
            target.kind === "chatNote"
        ) {
            return (
                <ModalNoteView
                    hostZIndex={effectiveZIndex}
                    target={target}
                    onClose={onClose}
                    {...rest}
                />
            );
        }
        return null;
    };

    // Backdrop matches Joy's default modal scrim but a touch deeper so
    // the dialog reads as floating over the chat. The dialog itself
    // borrows the bubble-style soft shadow + 20px corner radius from
    // elsewhere in the app so the preview doesn't look like a foreign
    // OS dialog.
    return (
        <Modal
            open={target !== null}
            sx={{
                zIndex: effectiveZIndex,
                // Joy pins Select/Autocomplete listbox popups to
                // calc(theme.zIndex.modal + 1) ≈ 1301 and does NOT track the
                // raised `zIndex` above. Left as-is, the task/milestone
                // autocompletes rendered inside these views (assignee,
                // reporter, project, priority, effort, status, sprint…) open
                // at ~1301 — far *behind* this modal — and appear empty. This
                // is exactly what a user opening a task from the task diagram
                // hits: the picker dropdowns show nothing. Re-stamp the var on
                // the modal root (inline listboxes inherit it) and on sibling
                // portaled listboxes so the popups render above the dialog.
                "--unstable_popup-zIndex": effectiveZIndex + 10,
                '& ~ [role="listbox"]': { "--unstable_popup-zIndex": effectiveZIndex + 10 },
            }}
            slotProps={{
                backdrop: {
                    sx: {
                        backdropFilter: "blur(2px)",
                        backgroundColor: g.scrim,
                    },
                },
            }}
            onClose={onClose}
        >
            <ModalDialog
                // `fullscreen` pins the dialog to all four edges of the modal
                // root, so no height / width / centring transform is set for it.
                layout={fullScreen ? "fullscreen" : "center"}
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    p: 0,
                    ...(fullScreen
                        ? {
                              // The card's border, radius and shadow only read as a card
                              // when something shows around it. Joy's fullscreen layout
                              // already zeroes border and radius; the shadow is ours.
                              boxShadow: "none",
                              // Joy modals paint over the tab bar and the keyboard: keep
                              // the content off the home indicator, and off the keyboard
                              // when it is up (iOS doesn't resize the layout viewport).
                              paddingBottom:
                                  "max(env(safe-area-inset-bottom, 0px), var(--keyboard-inset, 0px))",
                          }
                        : {
                              border: `1px solid ${g.border.default}`,
                              borderRadius: g.radius.lg,
                              boxShadow: g.shadow.lg,
                              height: "min(900px, 88vh)",
                              width: "min(1200px, 92vw)",
                          }),
                }}
            >
                {/* Both labels open BELOW their button: this chrome is
                    flush against the dialog's top edge, so the default
                    `top` placement would float the label off the dialog
                    and over the backdrop. Portaled at the theme's 13300
                    tooltip token, which clears every dialog level this
                    modal is opened at (10020 … 13200). */}
                {onOpenFullPage && (
                    <AppTooltip placement="bottom" title={t.common.modalView.openFullPage}>
                        <IconButton
                            aria-label={t.common.modalView.openFullPage}
                            size="md"
                            variant="plain"
                            sx={{
                                ...floatingChromeSx,
                                // Immediately left of the ✕ (12 + its 36px
                                // width + an 8px gap). Both sit in the same
                                // corner the views keep clear for chrome.
                                position: "absolute",
                                right: 56,
                                top: 12,
                            }}
                            onClick={onOpenFullPage}
                        >
                            <LaunchRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </AppTooltip>
                )}
                <AppTooltip placement="bottom" title={t.common.actions.close}>
                    <ModalClose
                        // Joy ships the ✕ with no accessible name, and a
                        // tooltip is only a description — so name it here
                        // too, matching the label the tooltip shows.
                        aria-label={t.common.actions.close}
                        sx={{
                            ...floatingChromeSx,
                            right: 12,
                            top: 12,
                        }}
                    />
                </AppTooltip>
                <Suspense fallback={<ViewLoadingFallback />}>{renderBody()}</Suspense>
            </ModalDialog>
        </Modal>
    );
};
