import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
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
import { useTeamConnections } from "../../../admin/components/team/useTeamConnections";

export type TeamFolderNameMode = "create-root" | "create-child" | "rename";

type Props = {
    open: boolean;
    mode: TeamFolderNameMode;
    initialName?: string;
    initialVisibility?: NoteFolderVisibility | null;
    // Only shown on a subfolder, where "inherit" is a real option (and
    // the default). A top-level folder has no ancestor to inherit from.
    parentName?: string;
    /** Whose connections to offer when sharing across teams. */
    teamId: string;
    onClose: () => void;
    onSubmit: (
        name: string,
        visibility: NoteFolderVisibility | null,
        /** Teams to offer the new folder to. Empty unless sharing. */
        guestTeamIds: string[]
    ) => void;
};

// Create or rename a team folder. Unlike the My Notes dialog this also
// carries VISIBILITY, because for a team folder "who can see it" is part
// of creating it, not a follow-up step.
//
// `null` visibility means INHERIT and is the default for a subfolder —
// that is what makes "accessible to everyone who can reach the parent"
// the zero-effort path, with narrowing a deliberate choice.
//
// "Share with another organization" sits in the same list as a fourth
// answer, and resolves to private plus an offer to the teams picked.
// Sharing does require a restricted folder — public means "every host
// member is an editor" plus a team-wide search sentinel, which cannot
// also mean "and one other company" — but that is a rule about the
// implementation, and leaving the user to deduce it from a list of two
// visibilities is how the feature stayed invisible to the people it is
// for.
export const ModalTeamFolderName = (props: Props) => {
    const { open, mode, initialName, initialVisibility, parentName, teamId, onClose, onSubmit } =
        props;
    const { t } = useTranslation();
    const hostZIndex = useNoteModalHostZIndex();

    const isChild = mode === "create-child";
    const [name, setName] = useState(initialName ?? "");
    const [visibility, setVisibility] = useState<NoteFolderVisibility | null>(
        initialVisibility !== undefined ? initialVisibility : isChild ? null : "public"
    );
    const [shareExternally, setShareExternally] = useState(false);
    const [guestTeamIds, setGuestTeamIds] = useState<string[]>([]);
    // Only asked while the dialog is open — this component stays mounted
    // for the sidebar's whole life, and an empty team id skips the fetch.
    const { active: connectedTeams } = useTeamConnections(open ? teamId : "");

    useEffect(() => {
        if (!open) return;
        setName(initialName ?? "");
        setVisibility(
            initialVisibility !== undefined ? initialVisibility : isChild ? null : "public"
        );
        setShareExternally(false);
        setGuestTeamIds([]);
    }, [open, initialName, initialVisibility, isChild]);

    const trimmed = name.trim();
    // Sharing with nobody is not sharing: it would create a folder whose
    // only distinguishing feature is a restriction the user did not ask for.
    const isValid =
        trimmed.length > 0 &&
        trimmed.length <= 255 &&
        (!shareExternally || guestTeamIds.length > 0);

    const submit = () => {
        if (!isValid) return;
        onSubmit(trimmed, shareExternally ? "private" : visibility, guestTeamIds);
        onClose();
    };

    const choose = (value: string) => {
        setShareExternally(value === "external");
        if (value === "external") return;
        setVisibility(value === "inherit" ? null : (value as NoteFolderVisibility));
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
                                value={
                                    shareExternally
                                        ? "external"
                                        : visibility === null
                                          ? "inherit"
                                          : visibility
                                }
                                onChange={(e) => choose(e.target.value)}
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
                                    {/* Absent, not disabled, when there is
                                        nobody to share with: an option that
                                        can only ever be empty is worse than
                                        one that isn't there, and connections
                                        are made in team settings. */}
                                    {connectedTeams.length > 0 && (
                                        <Box>
                                            <OptionRow
                                                hint={t.notes.teamNotes.visibilityExternalHint}
                                                label={t.notes.teamNotes.visibilityExternal}
                                                value="external"
                                            />
                                            {shareExternally && (
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        flexWrap: "wrap",
                                                        gap: 0.75,
                                                        ml: 3.5,
                                                        mt: 1,
                                                    }}
                                                >
                                                    {connectedTeams.map((connection) => {
                                                        const selected = guestTeamIds.includes(
                                                            connection.teamId
                                                        );
                                                        return (
                                                            <Chip
                                                                key={connection.teamId}
                                                                color={
                                                                    selected
                                                                        ? "primary"
                                                                        : "neutral"
                                                                }
                                                                size="sm"
                                                                variant={
                                                                    selected ? "solid" : "outlined"
                                                                }
                                                                onClick={() =>
                                                                    setGuestTeamIds((prev) =>
                                                                        prev.includes(
                                                                            connection.teamId
                                                                        )
                                                                            ? prev.filter(
                                                                                  (id) =>
                                                                                      id !==
                                                                                      connection.teamId
                                                                              )
                                                                            : [
                                                                                  ...prev,
                                                                                  connection.teamId,
                                                                              ]
                                                                    )
                                                                }
                                                            >
                                                                {connection.teamName}
                                                            </Chip>
                                                        );
                                                    })}
                                                </Box>
                                            )}
                                        </Box>
                                    )}
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
