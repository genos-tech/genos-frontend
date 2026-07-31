import { useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { Box, Button, Chip, Input, Modal, ModalDialog, Typography } from "@mui/joy";

import {
    noteModalChildStackSx,
    useNoteModalHostZIndex,
} from "../../../../components/modals/noteModalHostZIndex";
import { useAuth } from "../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TeamNoteFolderTreeNode } from "../../../../types/notes";
import {
    createNoteFolderTag,
    loadNoteFolderTags,
    NoteFolderTagWithUsage,
    setFolderTags,
} from "../services/teamNoteFolderTags";

type Props = {
    open: boolean;
    folder: TeamNoteFolderTreeNode | null;
    myself: UserProps;
    onClose: () => void;
    onChanged: () => void;
};

// Pick which of the team's tags apply to one folder, and coin new ones
// inline.
//
// The vocabulary is team-shared, so this shows ALL of it with the
// folder's own tags selected — rather than a free-text field, which
// would let near-duplicates ("eng", "Eng", "engineering") accumulate and
// quietly make filtering useless. Creating is idempotent server-side on
// (team, name), so typing a name that already exists selects the
// existing tag instead of forking it.
export const ModalTeamFolderTags = (props: Props) => {
    const { open, folder, myself, onClose, onChanged } = props;
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const hostZIndex = useNoteModalHostZIndex();

    const [allTags, setAllTags] = useState<NoteFolderTagWithUsage[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [newName, setNewName] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !folder) return;
        setNewName("");
        setSelected(new Set(folder.tags.map((tg) => tg.tagId)));
        void loadNoteFolderTags(myself, accessToken).then(setAllTags);
    }, [open, folder?.folderId]);

    const toggle = (tagId: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(tagId)) next.delete(tagId);
            else next.add(tagId);
            return next;
        });

    const trimmed = newName.trim();
    const canCreate = useMemo(
        () =>
            trimmed.length > 0 &&
            trimmed.length <= 40 &&
            !allTags.some((tg) => tg.name.toLowerCase() === trimmed.toLowerCase()),
        [trimmed, allTags]
    );

    const addNew = async () => {
        if (!canCreate) return;
        const created = await createNoteFolderTag(myself, trimmed, accessToken);
        if (created) {
            setAllTags((prev) => [...prev, { ...created, createdBy: null, folderCount: 0 }]);
            setSelected((prev) => new Set(prev).add(created.tagId));
        }
        setNewName("");
    };

    const submit = async () => {
        if (!folder) return;
        setSaving(true);
        await setFolderTags(myself, folder.folderId, Array.from(selected), accessToken);
        setSaving(false);
        onChanged();
        onClose();
    };

    return (
        <Modal open={open} sx={noteModalChildStackSx(hostZIndex)} onClose={onClose}>
            <ModalDialog sx={{ maxWidth: 480, minWidth: 380 }}>
                <Typography level="title-md">
                    {fmt(t.notes.teamNotes.tagsTitle, { name: folder?.name ?? "" })}
                </Typography>

                {allTags.length === 0 ? (
                    <Typography level="body-sm" sx={{ fontStyle: "italic", mt: 1, opacity: 0.7 }}>
                        {t.notes.teamNotes.noTags}
                    </Typography>
                ) : (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.5 }}>
                        {allTags.map((tg) => {
                            const isOn = selected.has(tg.tagId);
                            return (
                                <Chip
                                    key={tg.tagId}
                                    color={isOn ? "primary" : "neutral"}
                                    size="sm"
                                    variant={isOn ? "solid" : "outlined"}
                                    onClick={() => toggle(tg.tagId)}
                                >
                                    {tg.name}
                                </Chip>
                            );
                        })}
                    </Box>
                )}

                <Box sx={{ alignItems: "center", display: "flex", gap: 1, mt: 2 }}>
                    <Input
                        placeholder={t.notes.teamNotes.newTagPlaceholder}
                        size="sm"
                        sx={{ flexGrow: 1 }}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void addNew();
                        }}
                    />
                    <Button
                        disabled={!canCreate}
                        size="sm"
                        startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                        variant="soft"
                        onClick={() => void addNew()}
                    >
                        {t.notes.folders.create}
                    </Button>
                </Box>

                <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
                    <Button color="neutral" variant="plain" onClick={onClose}>
                        {t.notes.folders.cancel}
                    </Button>
                    <Button disabled={saving} loading={saving} onClick={() => void submit()}>
                        {t.notes.folders.save}
                    </Button>
                </Box>
            </ModalDialog>
        </Modal>
    );
};
