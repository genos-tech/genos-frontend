import { useCallback, useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
    Box,
    Button,
    Dropdown,
    FormControl,
    FormHelperText,
    FormLabel,
    IconButton,
    MenuButton,
} from "@mui/joy";

import { MenuDivider, MenuRow, MenuSurface } from "../../../components/ui/MoreMenu";
import { useAuth } from "../../../context/authState";
import { fmt, useTranslation } from "../../../i18n";
import { ProjectTagChip } from "../../tasks/components/ProjectTagChip";
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "../memory/confirmLayer";
import { ModalManageSkillTags } from "./ModalManageSkillTags";
import {
    createSkillTag,
    deleteSkillTag,
    fetchSkillTags,
    SKILL_LIMITS,
    updateSkillTag,
    type SkillTag,
} from "./skillsApi";

type Props = {
    skillId: string;
    teamId: string;
    /** The tag names on the draft. */
    selected: readonly string[];
    disabled: boolean;
    /** A sentence about the field (the server's, or the form's own). */
    problem?: string | null;
    onChange: (tags: string[]) => void;
    /** Manage tags renamed (`next` = the new name) or deleted (`next` = null) a tag the draft or the
     *  saved skill may carry: the editor rewrites both so nothing shows as an edit nobody made. */
    onCatalogRewrite?: (name: string, next: string | null) => void;
};

/**
 * The Tags field of the skill editor (MIP-2211): the tags on the skill as chips, a picker over the
 * member's catalog and "Manage tags". No free text: a tag has to exist before it can be picked, and
 * it is made in Manage tags, like to-do tags. The catalog belongs to the skill's OWNER; a co-editor
 * picks from it and has no Manage tags.
 */
export const SkillTagsField = ({
    skillId,
    teamId,
    selected,
    disabled,
    problem,
    onChange,
    onCatalogRewrite,
}: Props) => {
    const { t } = useTranslation();
    const f = t.settings.genosSkills.fields;
    const { accessToken } = useAuth();
    const [tags, setTags] = useState<SkillTag[]>([]);
    const [editable, setEditable] = useState(false);
    const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
    const [managing, setManaging] = useState(false);

    const load = useCallback(async () => {
        // The catalog is the owner's: a reader gets 403/404 from it (MIP-2307). A disabled field has
        // no picker, and the chips come from the skill, so it never asks.
        if (disabled) return;
        const res = await fetchSkillTags(accessToken, { skillId });
        if (!res.ok) {
            setState("failed");
            return;
        }
        setTags(res.data.tags);
        setEditable(res.data.editable);
        setState("ready");
    }, [accessToken, skillId, disabled]);

    useEffect(() => {
        // A fetch whose answer sets the state; the first render has nothing to draw.
        void load();
    }, [load]);

    const colorOf = (name: string) => tags.find((x) => x.name === name)?.color ?? "";
    const full = selected.length >= SKILL_LIMITS.tagsMax;
    const toggle = (name: string) =>
        onChange(
            selected.includes(name) ? selected.filter((x) => x !== name) : [...selected, name]
        );

    const handleCreate = async (name: string, color?: { color: string; textColor: string }) => {
        const res = await createSkillTag(accessToken, teamId, { name, ...color });
        if (!res.ok) return undefined;
        setTags((prev) => [...prev, res.data]);
        return res.data;
    };
    const handleUpdate = async (
        tagId: number,
        patch: { name?: string; color?: string; textColor?: string }
    ) => {
        const before = tags.find((x) => x.tagId === tagId);
        const res = await updateSkillTag(accessToken, tagId, patch);
        if (!res.ok) return undefined;
        setTags((prev) => prev.map((x) => (x.tagId === tagId ? res.data : x)));
        if (before && before.name !== res.data.name) {
            onCatalogRewrite?.(before.name, res.data.name);
        }
        return res.data;
    };
    const handleDelete = async (tagId: number) => {
        const before = tags.find((x) => x.tagId === tagId);
        const res = await deleteSkillTag(accessToken, tagId);
        if (!res.ok) return false;
        setTags((prev) => prev.filter((x) => x.tagId !== tagId));
        if (before) onCatalogRewrite?.(before.name, null);
        return true;
    };

    const help =
        problem ??
        (disabled
            ? null
            : state === "failed"
              ? f.tagsLoadFailed
              : !editable && state === "ready"
                ? `${fmt(f.tagsHelp, { max: SKILL_LIMITS.tagsMax })} ${f.tagsOwnerOnly}`
                : fmt(f.tagsHelp, { max: SKILL_LIMITS.tagsMax }));

    // The dialog is a sibling of the form control, not inside it: Joy's inputs read the form
    // control from React context, which a portal does not cut off, so its fields would take the
    // Tags label's id and turn red with the Tags problem.
    return (
        <>
            <FormControl error={!!problem || state === "failed"}>
                <FormLabel id="skill-tags-label">{f.tags}</FormLabel>
                <Box
                    aria-labelledby="skill-tags-label"
                    role="group"
                    sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}
                >
                    {selected.map((name) => (
                        <Box
                            key={name}
                            sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}
                        >
                            <ProjectTagChip label={name} size="md" tagColor={colorOf(name)} />
                            {!disabled && (
                                <IconButton
                                    aria-label={fmt(f.removeTag, { tag: name })}
                                    size="sm"
                                    variant="plain"
                                    sx={{
                                        "--IconButton-size": "20px",
                                        minHeight: 20,
                                        minWidth: 20,
                                    }}
                                    onClick={() => toggle(name)}
                                >
                                    <CloseRoundedIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                            )}
                        </Box>
                    ))}
                    {selected.length === 0 && (disabled || state !== "ready") && (
                        <Box
                            component="span"
                            sx={{ typography: "body-sm", color: "text.tertiary" }}
                        >
                            {f.tagsNone}
                        </Box>
                    )}
                    {!disabled && state === "ready" && (
                        <Dropdown onOpenChange={(_e, open) => open && void load()}>
                            <MenuButton
                                size="sm"
                                slots={{ root: Button }}
                                slotProps={{
                                    root: {
                                        size: "sm",
                                        variant: "plain",
                                        startDecorator: <AddRoundedIcon />,
                                    },
                                }}
                            >
                                {f.tagsAdd}
                            </MenuButton>
                            <MenuSurface
                                placement="bottom-start"
                                sx={{ minWidth: 200, maxHeight: 320, overflowY: "auto" }}
                                zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
                            >
                                {tags.length === 0 && (
                                    <Box
                                        sx={{
                                            px: 1.5,
                                            py: 1,
                                            typography: "body-sm",
                                            color: "text.tertiary",
                                        }}
                                    >
                                        {f.tagsNone}
                                    </Box>
                                )}
                                {tags.map((tag) => {
                                    const on = selected.includes(tag.name);
                                    return (
                                        <MenuRow
                                            key={tag.tagId}
                                            disabled={!on && full}
                                            selected={on}
                                            keepOpen
                                            onClick={() => toggle(tag.name)}
                                        >
                                            <ProjectTagChip
                                                label={tag.name}
                                                tagColor={tag.color}
                                            />
                                        </MenuRow>
                                    );
                                })}
                                {editable && <MenuDivider />}
                                {editable && (
                                    <MenuRow
                                        icon={<SettingsRoundedIcon />}
                                        onClick={() => setManaging(true)}
                                    >
                                        {f.manageTags}
                                    </MenuRow>
                                )}
                            </MenuSurface>
                        </Dropdown>
                    )}
                </Box>
                {help && <FormHelperText>{help}</FormHelperText>}
            </FormControl>
            {editable && (
                <ModalManageSkillTags
                    open={managing}
                    tags={tags}
                    onClose={() => setManaging(false)}
                    onCreate={handleCreate}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                />
            )}
        </>
    );
};
