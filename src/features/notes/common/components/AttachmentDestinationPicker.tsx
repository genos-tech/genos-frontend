import { useEffect, useMemo, useRef, useState } from "react";
import { FormControl, FormLabel, Option, Select, Typography } from "@mui/joy";
import Autocomplete, { createFilterOptions } from "@mui/joy/Autocomplete";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { UserProps } from "../../../../types/admin";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import { useChannelList } from "../../../channel/hooks/useChannelList";
import { loadTeamTaskList } from "../../../tasks/services/loadTaskSearchList";
import {
    chatTypeLabel,
    flattenFolders,
    type DestinationOption,
} from "../services/noteImportDestinations";

/**
 * Where an imported ATTACHMENT becomes a note.
 *
 * Unlike the note-header import (whose kind is fixed by the surface it
 * was opened from), an attachment can go to any of the four kinds of
 * note. Every shape here maps 1:1 onto a `useNM.handleCreateNew*` call;
 * the server still enforces permissions on each create.
 */
export type AttachmentDestination =
    | { kind: "my"; folderId: number | null }
    | { kind: "team"; folderId: number }
    | { kind: "task"; projectId: number; taskId: number }
    /** `channelId` is the v3 channel UUID (what the API keys chat notes on). */
    | { kind: "chat"; channelId: string; chatType: number };

export type AttachmentDestinationKind = AttachmentDestination["kind"];

/** A picked destination plus the words to describe it afterwards. */
export type AttachmentDestinationSelection = {
    destination: AttachmentDestination;
    label: string;
};

/** A team folder is writable when the viewer's role is above Viewer
 *  (roles: 1 owner, 2 editor, 3 viewer) — same test as the sidebar. */
const TEAM_FOLDER_WRITE_BELOW_ROLE = 3;

const MY_ROOT_KEY = "root";

const filterRows = createFilterOptions<DestinationOption>({
    limit: 100,
    stringify: (option) => option.label,
});

interface Props {
    useNM: NoteManagementState;
    myself: UserProps;
    accessToken: string | null;
    /** What to preselect. Omitted = My Notes (root). */
    defaultDestination?: AttachmentDestination;
    /** Called with the current pick, or null while nothing valid is picked. */
    onChange: (selection: AttachmentDestinationSelection | null) => void;
}

type TaskRow = DestinationOption & { projectId: number; taskId: number };

const taskKey = (projectId: number, taskId: number) => `${projectId}-${taskId}`;

export const AttachmentDestinationPicker = ({
    useNM,
    myself,
    accessToken,
    defaultDestination,
    onChange,
}: Props) => {
    const { t } = useTranslation();
    const labels = t.notes.importMd;

    const [kind, setKind] = useState<AttachmentDestinationKind>(defaultDestination?.kind ?? "my");
    const [myKey, setMyKey] = useState<string>(
        defaultDestination?.kind === "my" && defaultDestination.folderId != null
            ? String(defaultDestination.folderId)
            : MY_ROOT_KEY
    );
    const [teamKey, setTeamKey] = useState<string | null>(
        defaultDestination?.kind === "team" ? String(defaultDestination.folderId) : null
    );
    const [taskPick, setTaskPick] = useState<string | null>(
        defaultDestination?.kind === "task"
            ? taskKey(defaultDestination.projectId, defaultDestination.taskId)
            : null
    );
    const [chatPick, setChatPick] = useState<string | null>(
        defaultDestination?.kind === "chat" ? defaultDestination.channelId : null
    );

    // Folder lists may not be loaded yet when the dialog is opened from a
    // chat or a task. Both refreshes are idempotent.
    useEffect(() => {
        void useNM.getMyNoteFolders();
        void useNM.getTeamNoteFolders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- My Notes ---------------------------------------------------------
    const myOptions = useMemo<DestinationOption[]>(
        () => [
            { key: MY_ROOT_KEY, label: labels.rootFolder },
            ...flattenFolders(useNM.myNoteFolders),
        ],
        [useNM.myNoteFolders, labels.rootFolder]
    );

    // ---- Team Notes: only folders the viewer may write to ------------------
    // Flatten ALL folders first and filter the rows after: filtering the
    // folders first would orphan a writable child of a read-only parent
    // (its path would vanish because the walk starts at the root).
    const teamOptions = useMemo<DestinationOption[]>(() => {
        const writable = new Set(
            useNM.teamNoteFolders
                .filter((f) => f.myRoleId < TEAM_FOLDER_WRITE_BELOW_ROLE)
                .map((f) => String(f.folderId))
        );
        return flattenFolders(useNM.teamNoteFolders).filter((o) => writable.has(o.key));
    }, [useNM.teamNoteFolders]);

    // ---- Tasks: every task in reach, not just ones that already hold notes -
    const [tasks, setTasks] = useState<TaskRow[] | null>(null);
    useEffect(() => {
        if (kind !== "task" || tasks != null) return;
        let live = true;
        void (async () => {
            const rows: SearchTeamTasksResponse[] | undefined = await loadTeamTaskList(
                myself,
                -1,
                "open,wip,blocked,pending",
                -1,
                accessToken,
                false
            );
            if (!live) return;
            setTasks(
                (Array.isArray(rows) ? rows : []).map((r) => ({
                    key: taskKey(r.projectId, r.taskId),
                    projectId: r.projectId,
                    taskId: r.taskId,
                    label: [
                        r.projectName,
                        r.displayId ? `${r.displayId} ${r.title}` : r.title,
                    ].join(" › "),
                }))
            );
        })();
        return () => {
            live = false;
        };
    }, [kind, tasks, myself, accessToken]);
    const taskOptions = useMemo<TaskRow[]>(() => {
        const rows = tasks ?? [];
        // The task the dialog was opened on may be Closed (so absent from
        // the open-statuses list): keep it selectable as the default.
        if (
            defaultDestination?.kind === "task" &&
            !rows.some(
                (r) => r.key === taskKey(defaultDestination.projectId, defaultDestination.taskId)
            )
        ) {
            return [
                {
                    key: taskKey(defaultDestination.projectId, defaultDestination.taskId),
                    projectId: defaultDestination.projectId,
                    taskId: defaultDestination.taskId,
                    label: `#${defaultDestination.taskId}`,
                },
                ...rows,
            ];
        }
        return rows;
    }, [tasks, defaultDestination]);

    // ---- Chats: the live channel store; fetch once if it is still empty ----
    const { channels } = useChannelList();
    const [fetchedChannels, setFetchedChannels] = useState(false);
    useEffect(() => {
        if (kind !== "chat" || channels.length > 0 || fetchedChannels) return;
        setFetchedChannels(true);
        void channelService
            .listChannels()
            .then((list) => {
                for (const ch of list) channelService.handleChannelCreated(ch);
            })
            .catch(() => {
                /* leave the empty state */
            });
    }, [kind, channels.length, fetchedChannels]);
    const chatOptions = useMemo(
        () =>
            channels.map((c) => ({
                key: c.id,
                chatType: c.kind as number,
                label: `${chatTypeLabel(c.kind as number, t)} › ${c.title}`,
            })),
        [channels, t]
    );

    // ---- The pick, normalised ---------------------------------------------
    const selection = useMemo<AttachmentDestinationSelection | null>(() => {
        if (kind === "my") {
            const row = myOptions.find((o) => o.key === myKey);
            if (!row) return null;
            return {
                destination: {
                    kind: "my",
                    folderId: myKey === MY_ROOT_KEY ? null : Number(myKey),
                },
                label: row.label,
            };
        }
        if (kind === "team") {
            const row = teamOptions.find((o) => o.key === teamKey);
            return row
                ? { destination: { kind: "team", folderId: Number(row.key) }, label: row.label }
                : null;
        }
        if (kind === "task") {
            const row = taskOptions.find((o) => o.key === taskPick);
            return row
                ? {
                      destination: { kind: "task", projectId: row.projectId, taskId: row.taskId },
                      label: row.label,
                  }
                : null;
        }
        const row = chatOptions.find((o) => o.key === chatPick);
        return row
            ? {
                  destination: { kind: "chat", channelId: row.key, chatType: row.chatType },
                  label: row.label,
              }
            : null;
    }, [
        kind,
        myKey,
        teamKey,
        taskPick,
        chatPick,
        myOptions,
        teamOptions,
        taskOptions,
        chatOptions,
    ]);

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const selectionKey = selection ? JSON.stringify(selection.destination) : "";
    useEffect(() => {
        onChangeRef.current(selection);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectionKey]);

    // Offer only kinds that can hold something. Task and chat stay listed
    // (their lists load lazily); Team Notes needs at least one folder the
    // viewer can write to.
    const kinds: { value: AttachmentDestinationKind; label: string }[] = [
        { value: "my", label: labels.kindMy },
        ...(teamOptions.length > 0 || kind === "team"
            ? [{ value: "team" as const, label: labels.kindTeam }]
            : []),
        { value: "task", label: labels.kindTask },
        { value: "chat", label: labels.kindChat },
    ];

    const renderPicker = (
        label: string,
        options: DestinationOption[],
        value: string | null,
        setValue: (key: string) => void,
        loading = false
    ) => (
        <FormControl sx={{ mt: 1.5 }}>
            <FormLabel>{label}</FormLabel>
            <Autocomplete
                filterOptions={filterRows}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, v) => option.key === v.key}
                loading={loading}
                options={options}
                placeholder={loading ? labels.loadingDestinations : undefined}
                value={options.find((o) => o.key === value) ?? null}
                autoHighlight
                onChange={(_e, v) => {
                    // A note always lands somewhere: ignore clearing.
                    if (v) setValue(v.key);
                }}
            />
            {!loading && options.length === 0 && (
                <Typography level="body-xs" sx={{ mt: 0.5 }}>
                    {labels.noDestinations}
                </Typography>
            )}
        </FormControl>
    );

    return (
        <>
            <FormControl sx={{ mt: 2 }}>
                <FormLabel>{labels.kindLabel}</FormLabel>
                <Select
                    value={kind}
                    onChange={(_e, v) => {
                        if (v) setKind(v);
                    }}
                >
                    {kinds.map((k) => (
                        <Option key={k.value} value={k.value}>
                            {k.label}
                        </Option>
                    ))}
                </Select>
            </FormControl>
            {kind === "my" && renderPicker(labels.folderLabel, myOptions, myKey, setMyKey)}
            {kind === "team" &&
                renderPicker(labels.teamFolderLabel, teamOptions, teamKey, setTeamKey)}
            {kind === "task" &&
                renderPicker(labels.taskLabel, taskOptions, taskPick, setTaskPick, tasks == null)}
            {kind === "chat" &&
                renderPicker(
                    labels.chatLabel,
                    chatOptions,
                    chatPick,
                    setChatPick,
                    channels.length === 0 && !fetchedChannels
                )}
        </>
    );
};
