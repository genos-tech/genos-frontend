import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import SubdirectoryArrowRightRoundedIcon from "@mui/icons-material/SubdirectoryArrowRightRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import {
    Box,
    Dropdown,
    IconButton,
    Input,
    ListDivider,
    Menu,
    MenuButton,
    MenuItem,
    Typography,
} from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useTranslation } from "../../../../i18n";
import { TodoCategoryProps } from "../../../../types/chat";

interface TodoItemMoreMenuProps {
    // Child rows get a Delete-only menu: subitems have no own deep link
    // and inherit the parent's tag (the view cascades tag changes).
    isChild: boolean;
    categories: TodoCategoryProps[];
    currentCategoryId: number | null;
    onSelectCategory: (categoryId: number | null) => void;
    onCreateCategory: (name: string) => Promise<TodoCategoryProps | undefined>;
    onCopyLink: () => void;
    linkCopied: boolean;
    // Opens the "remind me about this to-do" picker. Offered on child rows
    // too — a step of a task is still a thing you can forget — but NOT on a
    // completed one: the server refuses a reminder there, and a nudge about
    // something already dealt with is the noise that gets notifications
    // switched off. `undefined` hides the item.
    onRemindMe?: () => void;
    // "Reminder: 15:00" when one is pending, so the menu answers "when?"
    // without making the user open the picker to find out. Null → the
    // generic "Remind me…".
    reminderLabel?: string | null;
    // Opens the "create a task from this to-do" modal. Top-level rows
    // only, matching the other row-scoped actions above — a subitem is
    // part of its parent's item, not a candidate for its own task.
    onCreateTask: () => void;
    onDelete: () => void;
    // Mobile only: the notes toggle and "add subitem" are inline icon
    // buttons on desktop, but a phone row can't carry five of them, so
    // they fold in here as the first two items. `undefined` on desktop
    // (where the inline buttons are still shown) hides them, keeping one
    // affordance per action rather than two competing ones.
    onToggleNotes?: () => void;
    notesExpanded?: boolean;
    onAddSubitem?: () => void;
    // Carries the to-do over to tomorrow — the leftovers of a day. Absent
    // on a row where it would be a no-op or a lie: a to-do already ON
    // tomorrow, and a subitem (whose day is its parent's, so the server
    // refuses a lone child — the parent's menu is where this belongs).
    onMoveToTomorrow?: () => void;
}

// Consolidates the row's secondary actions (copy link, tag picker,
// delete) behind one ⋮ trigger — five inline icon buttons per row was
// too noisy. The tag picker (formerly the standalone CategoryPickerMenu
// trigger) lives inline in this menu as its own section: the tag list
// plus the create-new-tag input.
export const TodoItemMoreMenu = (props: TodoItemMoreMenuProps) => {
    const {
        isChild,
        categories,
        currentCategoryId,
        onSelectCategory,
        onCreateCategory,
        onCopyLink,
        linkCopied,
        onRemindMe,
        reminderLabel,
        onCreateTask,
        onDelete,
        onToggleNotes,
        notesExpanded,
        onAddSubitem,
        onMoveToTomorrow,
    } = props;
    const { t } = useTranslation();
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        const trimmed = newName.trim();
        if (!trimmed || creating) return;
        setCreating(true);
        const created = await onCreateCategory(trimmed);
        if (created) {
            onSelectCategory(created.categoryId);
        }
        setNewName("");
        setCreating(false);
    };

    return (
        <Dropdown>
            <AppTooltip title={t.chat.todoPane.moreOptions}>
                <MenuButton
                    aria-label={t.chat.todoPane.moreOptions}
                    slots={{ root: IconButton }}
                    slotProps={{
                        root: {
                            size: "sm",
                            variant: "plain",
                            sx: { borderRadius: "6px" },
                        },
                    }}
                >
                    <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
                </MenuButton>
            </AppTooltip>
            <Menu placement="bottom-end" size="sm" sx={{ minWidth: 200 }}>
                {/* Mobile-only row actions, folded in from the inline icon
                    strip. They lead because they act on THIS row's content
                    (its notes, its steps) rather than on the row as an
                    object, and the divider keeps that distinction. */}
                {onToggleNotes && (
                    <MenuItem onClick={onToggleNotes}>
                        {notesExpanded ? (
                            <ExpandLessRoundedIcon sx={{ fontSize: 16 }} />
                        ) : (
                            <ExpandMoreRoundedIcon sx={{ fontSize: 16 }} />
                        )}
                        <Typography level="body-sm">
                            {notesExpanded
                                ? t.chat.todoPane.collapseNotes
                                : t.chat.todoPane.expandNotes}
                        </Typography>
                    </MenuItem>
                )}
                {onAddSubitem && (
                    <MenuItem onClick={onAddSubitem}>
                        <SubdirectoryArrowRightRoundedIcon sx={{ fontSize: 16 }} />
                        <Typography level="body-sm">{t.chat.todoPane.addSubitem}</Typography>
                    </MenuItem>
                )}
                {(onToggleNotes || onAddSubitem) && <ListDivider />}
                {/* First, and on every open row including children: a to-do
                    you have to remember to look at is the case this whole
                    feature exists for. `selected` marks a pending one so the
                    state is visible before reading the label. */}
                {onRemindMe && (
                    <MenuItem selected={Boolean(reminderLabel)} onClick={onRemindMe}>
                        <NotificationsActiveRoundedIcon sx={{ fontSize: 16 }} />
                        <Typography level="body-sm">
                            {reminderLabel ?? t.chat.todoPane.remindMe.menu}
                        </Typography>
                    </MenuItem>
                )}
                {/* Next to the reminder, not down with copy-link/create-task:
                    both of these answer "not now" about the same to-do —
                    nudge me later, or carry it to tomorrow — whereas those
                    two take the to-do somewhere else. */}
                {onMoveToTomorrow && (
                    <MenuItem onClick={onMoveToTomorrow}>
                        <EventRepeatRoundedIcon sx={{ fontSize: 16 }} />
                        <Typography level="body-sm">{t.chat.todoPane.moveToTomorrow}</Typography>
                    </MenuItem>
                )}
                {!isChild && (
                    <MenuItem onClick={onCopyLink}>
                        <LinkRoundedIcon sx={{ fontSize: 16 }} />
                        <Typography level="body-sm">
                            {linkCopied ? t.chat.todoPane.linkCopied : t.chat.todoPane.copyLink}
                        </Typography>
                    </MenuItem>
                )}
                {!isChild && (
                    <MenuItem onClick={onCreateTask}>
                        <TaskAltRoundedIcon sx={{ fontSize: 16 }} />
                        <Typography level="body-sm">{t.chat.todoPane.createTask.menu}</Typography>
                    </MenuItem>
                )}
                {!isChild && (
                    <>
                        <ListDivider />
                        {/* Tag section — the old CategoryPickerMenu content,
                            inlined. Selecting closes the menu; typing in the
                            create input keeps it open (it's not a MenuItem). */}
                        <Typography
                            level="body-xs"
                            startDecorator={<LocalOfferRoundedIcon sx={{ fontSize: 12 }} />}
                            sx={{ opacity: 0.6, px: 1, py: 0.25 }}
                        >
                            {t.chat.todoPane.tag}
                        </Typography>
                        <MenuItem onClick={() => onSelectCategory(null)}>
                            <Box sx={{ width: 18 }}>
                                {currentCategoryId === null ? (
                                    <CheckIcon sx={{ fontSize: 16 }} />
                                ) : null}
                            </Box>
                            <Typography level="body-sm">{t.chat.todoPane.general}</Typography>
                        </MenuItem>
                        {categories.map((c) => (
                            <MenuItem
                                key={c.categoryId}
                                onClick={() => onSelectCategory(c.categoryId)}
                            >
                                <Box sx={{ width: 18 }}>
                                    {c.categoryId === currentCategoryId ? (
                                        <CheckIcon sx={{ fontSize: 16 }} />
                                    ) : null}
                                </Box>
                                <Typography level="body-sm">{c.name}</Typography>
                            </MenuItem>
                        ))}
                        <Box sx={{ display: "flex", gap: 0.5, p: 0.5 }}>
                            <Input
                                placeholder={t.chat.todoPane.newTagPlaceholder}
                                size="sm"
                                sx={{ flex: 1, fontSize: "0.8rem" }}
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleCreate();
                                    }
                                }}
                            />
                            <IconButton
                                disabled={!newName.trim() || creating}
                                size="sm"
                                sx={{ borderRadius: "6px" }}
                                variant="soft"
                                onClick={handleCreate}
                            >
                                <AddIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Box>
                        <ListDivider />
                    </>
                )}
                <MenuItem color="danger" onClick={onDelete}>
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                    <Typography color="danger" level="body-sm">
                        {t.chat.todoPane.delete}
                    </Typography>
                </MenuItem>
            </Menu>
        </Dropdown>
    );
};
