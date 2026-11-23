import { useState } from "react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import { Alert, Box, Button, IconButton, Input, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { EmptyState } from "../../../components/ui/feedback/EmptyState";
import { InlineTitleEdit } from "../../../components/ui/fields/InlineTitleEdit";
import { ModalFrame } from "../../../components/ui/modal/ModalFrame";
import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { TagColorOption } from "../../../types/tasks";
import { ColorPickerMenu } from "../../tasks/components/contents/base/sub/TagColorPickerMenu";
import { ProjectTagChip } from "../../tasks/components/ProjectTagChip";
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "../memory/confirmLayer";
import { SKILL_LIMITS, type SkillTag } from "./skillsApi";
import { normalizeTag, tagProblem } from "./skillText";

/** A name this dialog may send: the skill tag rules, and one the member doesn't have yet. The
 *  server checks both again (the rules are shared with the SKILL.md file and the directory). */
const validName = (
    raw: string,
    tags: readonly SkillTag[],
    excludeTagId?: number
): string | null => {
    const name = normalizeTag(raw);
    if (name === "" || tagProblem(name, []) !== null) return null;
    return tags.some((t) => t.tagId !== excludeTagId && t.name === name) ? null : name;
};

type Props = {
    open: boolean;
    onClose: () => void;
    tags: readonly SkillTag[];
    /** Each resolves to the saved tag, or `undefined` when the server refused. With no colour the
     *  server picks one from the palette. */
    onCreate: (
        name: string,
        color?: { color: string; textColor: string }
    ) => Promise<SkillTag | undefined>;
    onUpdate: (
        tagId: number,
        patch: { name?: string; color?: string; textColor?: string }
    ) => Promise<SkillTag | undefined>;
    onDelete: (tagId: number) => Promise<boolean>;
};

/**
 * Manage the member's skill tags: create, rename, recolour, delete (MIP-2211). The same dialog as
 * "Manage tags" of the to-do list (`ModalManageTodoTags`) and drawn with the same chip, colour
 * picker and inline rename, so a tag looks and behaves the same everywhere. Tags are per owner: a
 * skill's co-editor picks from the owner's list and never sees this dialog.
 */
export const ModalManageSkillTags = ({
    open,
    onClose,
    tags,
    onCreate,
    onUpdate,
    onDelete,
}: Props) => {
    const { t } = useTranslation();
    const f = t.settings.genosSkills.fields;
    // Two-click delete: the first click arms the row, the second confirms.
    const [armedDeleteId, setArmedDeleteId] = useState<number | null>(null);
    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [newName, setNewName] = useState("");
    // Empty until a colour is picked: the server then chooses one for the name.
    const [newColor, setNewColor] = useState<TagColorOption | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const invalidName = fmt(f.tagsInvalidName, { max: SKILL_LIMITS.tagMax });

    const reset = () => {
        setArmedDeleteId(null);
        setRenamingId(null);
        setError(null);
    };

    const commitRename = async (tag: SkillTag, next: string) => {
        const valid = validName(next, tags, tag.tagId);
        if (!valid) {
            setError(invalidName);
            return;
        }
        if (valid === tag.name) return;
        setError(null);
        const saved = await onUpdate(tag.tagId, { name: valid });
        if (!saved) setError(f.tagsSaveFailed);
    };

    const recolor = async (tag: SkillTag, c: TagColorOption) => {
        setError(null);
        const saved = await onUpdate(tag.tagId, { color: c.value, textColor: c.textColor });
        if (!saved) setError(f.tagsSaveFailed);
    };

    const create = async () => {
        const valid = validName(newName, tags);
        if (!valid) {
            setError(invalidName);
            return;
        }
        setBusy(true);
        setError(null);
        const created = await onCreate(
            valid,
            newColor ? { color: newColor.value, textColor: newColor.textColor } : undefined
        );
        setBusy(false);
        if (!created) {
            setError(f.tagsSaveFailed);
            return;
        }
        setNewName("");
        setNewColor(null);
    };

    const remove = async (tag: SkillTag) => {
        setArmedDeleteId(null);
        setError(null);
        if (!(await onDelete(tag.tagId))) setError(f.tagsDeleteFailed);
    };

    return (
        <ModalFrame
            closeLabel={f.tagsClose}
            description={f.tagsManageHint}
            icon={<LocalOfferRoundedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="sm"
            title={f.tagsManageTitle}
            zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
            onClose={() => {
                reset();
                onClose();
            }}
        >
            <Box sx={{ maxHeight: 320, overflowY: "auto", my: 1 }}>
                {tags.length === 0 && (
                    <EmptyState body={f.tagsEmptyList} data-empty="skill-tags" size="sm" />
                )}
                {tags.map((tag) => (
                    <Stack
                        key={tag.tagId}
                        alignItems="center"
                        data-testid={`skill-tag-row-${tag.tagId}`}
                        direction="row"
                        spacing={0.75}
                        sx={{
                            "&:hover": { background: g.hover },
                            borderRadius: g.radius.md,
                            px: 0.75,
                            py: 0.5,
                        }}
                    >
                        <ColorPickerMenu onSelectColor={(c) => void recolor(tag, c)} />
                        <InlineTitleEdit
                            ariaLabel={f.tagsRename}
                            editing={renamingId === tag.tagId}
                            maxLength={SKILL_LIMITS.tagMax}
                            sx={{ flex: 1, minWidth: 0 }}
                            value={tag.name}
                            renderValue={(name) => (
                                <ProjectTagChip label={name} tagColor={tag.color} />
                            )}
                            onCommit={(next) => void commitRename(tag, next)}
                            onEditingChange={(editing) =>
                                setRenamingId(editing ? tag.tagId : null)
                            }
                        />
                        <AppTooltip title={f.tagsRename}>
                            <IconButton
                                aria-label={`${f.tagsRename}: ${tag.name}`}
                                size="sm"
                                variant="plain"
                                onClick={() => setRenamingId(tag.tagId)}
                            >
                                <EditRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </AppTooltip>
                        {armedDeleteId === tag.tagId ? (
                            <Button
                                color="danger"
                                size="sm"
                                variant="solid"
                                onClick={() => void remove(tag)}
                            >
                                {f.tagsDeleteConfirm}
                            </Button>
                        ) : (
                            <IconButton
                                aria-label={`${f.tagsDelete}: ${tag.name}`}
                                color="danger"
                                size="sm"
                                variant="plain"
                                onClick={() => setArmedDeleteId(tag.tagId)}
                            >
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        )}
                    </Stack>
                ))}
            </Box>
            {armedDeleteId !== null && (
                <Typography level="body-xs" sx={{ mb: 1 }}>
                    {f.tagsDeleteHint}
                </Typography>
            )}

            <Stack alignItems="center" direction="row" spacing={0.5}>
                <Box
                    sx={{
                        background: newColor?.value ?? "transparent",
                        border: newColor ? "none" : "1px dashed",
                        borderColor: "neutral.outlinedBorder",
                        borderRadius: "50%",
                        flexShrink: 0,
                        height: 14,
                        width: 14,
                    }}
                />
                <ColorPickerMenu onSelectColor={setNewColor} />
                <Input
                    aria-label={f.tagsNewPlaceholder}
                    placeholder={f.tagsNewPlaceholder}
                    size="sm"
                    sx={{ flex: 1 }}
                    value={newName}
                    slotProps={{
                        input: { maxLength: SKILL_LIMITS.tagMax, autoCapitalize: "none" },
                    }}
                    onChange={(e) => {
                        setNewName(e.target.value);
                        setError(null);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            void create();
                        }
                    }}
                />
                <Button
                    disabled={busy || newName.trim().length === 0}
                    size="sm"
                    variant="soft"
                    onClick={() => void create()}
                >
                    {f.tagsCreate}
                </Button>
            </Stack>
            <Typography level="body-xs" sx={{ mt: 0.75 }} textColor="text.tertiary">
                {fmt(f.tagsNameRule, { max: SKILL_LIMITS.tagMax })}
            </Typography>
            {error && (
                <Alert color="warning" size="sm" sx={{ mt: 0.75 }}>
                    {error}
                </Alert>
            )}
        </ModalFrame>
    );
};
