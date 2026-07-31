import { useEffect, useState } from "react";
import {
    Box,
    Button,
    FormLabel,
    Input,
    Modal,
    ModalDialog,
    Radio,
    RadioGroup,
    Stack,
    Typography,
} from "@mui/joy";

import {
    noteModalChildStackSx,
    useNoteModalHostZIndex,
} from "../../../../components/modals/noteModalHostZIndex";
import { fmt, useTranslation } from "../../../../i18n";
import { NoteFolderVisibility } from "../../../../types/notes";

export type TeamFolderNameMode = "create-root" | "create-child" | "rename";

type Props = {
    open: boolean;
    mode: TeamFolderNameMode;
    initialName?: string;
    initialVisibility?: NoteFolderVisibility | null;
    // Only shown on a subfolder, where "inherit" is a real option (and
    // the default). A top-level folder has no ancestor to inherit from.
    parentName?: string;
    onClose: () => void;
    onSubmit: (name: string, visibility: NoteFolderVisibility | null) => void;
};

// Create or rename a team folder. Unlike the My Notes dialog this also
// carries VISIBILITY, because for a team folder "who can see it" is part
// of creating it, not a follow-up step.
//
// `null` visibility means INHERIT and is the default for a subfolder —
// that is what makes "accessible to everyone who can reach the parent"
// the zero-effort path, with narrowing a deliberate choice.
export const ModalTeamFolderName = (props: Props) => {
    const { open, mode, initialName, initialVisibility, parentName, onClose, onSubmit } = props;
    const { t } = useTranslation();
    const hostZIndex = useNoteModalHostZIndex();

    const isChild = mode === "create-child";
    const [name, setName] = useState(initialName ?? "");
    const [visibility, setVisibility] = useState<NoteFolderVisibility | null>(
        initialVisibility !== undefined ? initialVisibility : isChild ? null : "public"
    );

    useEffect(() => {
        if (!open) return;
        setName(initialName ?? "");
        setVisibility(
            initialVisibility !== undefined ? initialVisibility : isChild ? null : "public"
        );
    }, [open, initialName, initialVisibility, isChild]);

    const trimmed = name.trim();
    const isValid = trimmed.length > 0 && trimmed.length <= 255;

    const submit = () => {
        if (!isValid) return;
        onSubmit(trimmed, visibility);
        onClose();
    };

    const title = mode === "rename" ? t.notes.folders.renameTitle : t.notes.teamNotes.newFolder;

    return (
        <Modal open={open} sx={noteModalChildStackSx(hostZIndex)} onClose={onClose}>
            <ModalDialog sx={{ minWidth: 380, maxWidth: 460 }}>
                <Typography level="title-md">{title}</Typography>

                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Input
                        autoFocus
                        placeholder={t.notes.folders.folderNamePlaceholder}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") submit();
                        }}
                    />

                    {mode !== "rename" && (
                        <Box>
                            <FormLabel sx={{ mb: 1 }}>
                                {t.notes.teamNotes.visibilityLabel}
                            </FormLabel>
                            <RadioGroup
                                value={visibility === null ? "inherit" : visibility}
                                onChange={(e) =>
                                    setVisibility(
                                        e.target.value === "inherit"
                                            ? null
                                            : (e.target.value as NoteFolderVisibility)
                                    )
                                }
                            >
                                <Stack spacing={1.25}>
                                    {isChild && (
                                        <OptionRow
                                            hint={t.notes.teamNotes.visibilityInheritHint}
                                            value="inherit"
                                            label={
                                                parentName
                                                    ? fmt(t.notes.teamNotes.visibilityInherit, {
                                                          name: parentName,
                                                      })
                                                    : t.notes.teamNotes.visibilityInherit
                                            }
                                        />
                                    )}
                                    <OptionRow
                                        hint={t.notes.teamNotes.visibilityPublicHint}
                                        label={t.notes.teamNotes.visibilityPublic}
                                        value="public"
                                    />
                                    <OptionRow
                                        hint={t.notes.teamNotes.visibilityPrivateHint}
                                        label={t.notes.teamNotes.visibilityPrivate}
                                        value="private"
                                    />
                                </Stack>
                            </RadioGroup>
                        </Box>
                    )}
                </Stack>

                <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
                    <Button color="neutral" variant="plain" onClick={onClose}>
                        {t.notes.folders.cancel}
                    </Button>
                    <Button disabled={!isValid} onClick={submit}>
                        {mode === "rename" ? t.notes.folders.save : t.notes.folders.create}
                    </Button>
                </Box>
            </ModalDialog>
        </Modal>
    );
};

const OptionRow = (props: { value: string; label: string; hint: string }) => (
    <Box>
        <Radio label={props.label} size="sm" value={props.value} />
        <Typography level="body-xs" sx={{ ml: 3.5, opacity: 0.7 }}>
            {props.hint}
        </Typography>
    </Box>
);
