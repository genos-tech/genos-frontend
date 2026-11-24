import { useEffect, useState } from "react";
import {
    Button,
    FormControl,
    FormHelperText,
    FormLabel,
    Input,
    Option,
    Select,
    Stack,
    Typography,
} from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

import { useNoteModalHostZIndex } from "../../../components/modals/noteModalHostZIndex";
import { ModalFrame } from "../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../context/authState";
import { useTranslation } from "../../../i18n";
import type { UserProps } from "../../../types/admin";
import { loadSpecificNote } from "../common/services/loadSpecificNote";
import { saveTeamNoteTemplate, type NoteTemplateScope } from "./teamNoteTemplates";

type Props = {
    open: boolean;
    myself: UserProps;
    /** 1 = personal, 2 = task, 3 = chat (a shared note, 4, is 1). */
    noteType: 1 | 2 | 3;
    noteId: number;
    noteTitle: string;
    /** Used when the saved note cannot be read again. */
    fallbackBody?: unknown;
    onClose: () => void;
};

/**
 * "Save as template…" in a note's actions menu (MIP-2337). The note is read again so the
 * template holds the latest SAVED body; the person chooses whether it is theirs alone or the
 * team's. It then shows up in "New note from template…".
 */
export const ModalSaveNoteAsTemplate = ({
    open,
    myself,
    noteType,
    noteId,
    noteTitle,
    fallbackBody,
    onClose,
}: Props) => {
    const { t } = useTranslation();
    const copy = t.notes.noteTemplates.team;
    const { accessToken } = useAuth();
    const hostZIndex = useNoteModalHostZIndex();
    const theme = useTheme();
    const [name, setName] = useState("");
    const [scope, setScope] = useState<NoteTemplateScope>("personal");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (open) {
            setName(noteTitle.trim().slice(0, 100));
            setScope("personal");
            setError(null);
            setSaved(false);
        }
        // Only on open: a title edited meanwhile must not overwrite what is being typed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const save = async () => {
        if (!name.trim()) return;
        setBusy(true);
        setError(null);
        try {
            const fresh = await loadSpecificNote(myself, noteType, noteId, accessToken);
            const body = fresh && !fresh.error ? fresh.body : fallbackBody;
            const result = await saveTeamNoteTemplate(
                myself,
                {
                    scope,
                    name: name.trim(),
                    title: (fresh?.title || noteTitle || "").slice(0, 255),
                    body: Array.isArray(body) ? body : [],
                },
                accessToken
            );
            if (!result) {
                setError(copy.saveFailed);
                return;
            }
            setSaved(true);
        } finally {
            setBusy(false);
        }
    };

    return (
        <ModalFrame
            hostZIndex={hostZIndex}
            open={open}
            size="sm"
            title={copy.saveAsTitle}
            zIndex={theme.zIndex.modal}
            actions={
                saved ? (
                    <Button onClick={onClose}>{copy.done}</Button>
                ) : (
                    <>
                        <Button color="neutral" variant="plain" onClick={onClose}>
                            {t.notes.folders.cancel}
                        </Button>
                        <Button
                            disabled={busy || !name.trim()}
                            loading={busy}
                            onClick={() => void save()}
                        >
                            {t.notes.folders.save}
                        </Button>
                    </>
                )
            }
            ownsListboxPopups
            onClose={onClose}
        >
            {saved ? (
                <Typography level="body-sm" role="status">
                    {copy.savedAsTemplate}
                </Typography>
            ) : (
                <Stack spacing={1.5}>
                    <FormControl>
                        <FormLabel>{copy.name}</FormLabel>
                        <Input
                            slotProps={{ input: { maxLength: 100 } }}
                            value={name}
                            autoFocus
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void save();
                            }}
                        />
                    </FormControl>
                    <FormControl>
                        <FormLabel>{copy.scope}</FormLabel>
                        <Select value={scope} onChange={(_, v) => setScope(v ?? "personal")}>
                            <Option value="personal">{copy.scopePersonal}</Option>
                            <Option value="team">{copy.scopeTeam}</Option>
                        </Select>
                        <FormHelperText>{copy.saveAsHint}</FormHelperText>
                    </FormControl>
                    {error && (
                        <Typography color="danger" level="body-xs" role="alert">
                            {error}
                        </Typography>
                    )}
                </Stack>
            )}
        </ModalFrame>
    );
};
