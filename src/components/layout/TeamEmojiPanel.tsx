import { useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EmojiEmotionsRoundedIcon from "@mui/icons-material/EmojiEmotionsRounded";
import { Box, Button, IconButton, Input, Sheet, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTeamEmojiContext } from "../../context/TeamEmojiContext";
import { UserProps } from "../../types/admin";
import { CustomEmojiImg } from "../editors/CustomEmoji";
import { AppTooltip } from "../ui/AppTooltip";

type Props = {
    myself: UserProps;
    // userId -> profile, for showing who uploaded each emoji.
    teamMemberProfiles: Record<string, UserProps>;
};

// Client-side mirrors of the server rules (team_emoji_views.py) so the
// common failures surface before a round trip. The server remains the
// authority — anything that slips through still gets a 4xx.
const NAME_RE = /^[a-z0-9_+-]{1,50}$/;
const MAX_BYTES = 512 * 1024;
const ALLOWED_EXT = /\.(png|jpe?g|gif|webp)$/i;

// Settings → Custom emoji. Grid of the team's emoji + upload form.
// Any member can upload; only the uploader sees a delete button (the
// server enforces the same rule with a 403). Deletes are soft — old
// messages keep rendering via their baked URL; the reaction chips fall
// back to the literal :name: text.
export const TeamEmojiPanel = ({ myself, teamMemberProfiles }: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { teamEmoji, loading, create, remove } = useTeamEmojiContext();

    const [name, setName] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const trimmedName = name.trim().toLowerCase();
    const nameInvalid = trimmedName.length > 0 && !NAME_RE.test(trimmedName);

    const resetForm = () => {
        setName("");
        setFile(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handlePickFile = (picked: File | null) => {
        setError(null);
        if (!picked) {
            setFile(null);
            return;
        }
        if (!ALLOWED_EXT.test(picked.name)) {
            setError("Use a .png, .jpg, .gif or .webp file.");
            setFile(null);
            return;
        }
        if (picked.size > MAX_BYTES) {
            setError("Emoji images must be 512 KB or smaller.");
            setFile(null);
            return;
        }
        setFile(picked);
        // Slack-style convenience: prefill the name from the filename.
        if (!name.trim()) {
            const base = picked.name.replace(/\.[^.]+$/, "").toLowerCase();
            const suggested = base.replace(/[^a-z0-9_+-]+/g, "-").replace(/^-+|-+$/g, "");
            if (suggested) setName(suggested.slice(0, 50));
        }
    };

    const handleUpload = async () => {
        if (!file || !trimmedName || nameInvalid || busy) return;
        setBusy(true);
        setError(null);
        const created = await create(trimmedName, file);
        setBusy(false);
        if (created) {
            resetForm();
        } else {
            // teamEmojiApi already logged the details; the common causes
            // are a duplicate name (409) or a rejected file (400/413).
            setError("Upload failed — is the name already taken?");
        }
    };

    return (
        <Sheet sx={{ borderRadius: "lg", p: 2 }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <EmojiEmotionsRoundedIcon />
                <Typography level="title-md">Custom emoji</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 2 }}>
                Team-wide emoji, animated GIFs welcome. Type :name: in any editor, pick them from
                the emoji picker, or use them as reactions. Anyone on the team can add one; only
                the uploader can remove it.
            </Typography>

            {/* Upload form */}
            <Sheet sx={{ p: 1.25, borderRadius: "md", mb: 2 }} variant="soft">
                <Stack
                    alignItems={{ xs: "stretch", sm: "center" }}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                >
                    <Button
                        size="sm"
                        startDecorator={<AddRoundedIcon />}
                        sx={{ whiteSpace: "nowrap" }}
                        variant="outlined"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {file ? file.name : "Choose image"}
                    </Button>
                    <input
                        ref={fileInputRef}
                        accept=".png,.jpg,.jpeg,.gif,.webp"
                        style={{ display: "none" }}
                        type="file"
                        onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                    />
                    <Input
                        error={nameInvalid}
                        placeholder="emoji-name (a-z, 0-9, _ + -)"
                        size="sm"
                        startDecorator=":"
                        endDecorator=":"
                        sx={{ flex: 1 }}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void handleUpload();
                        }}
                    />
                    <Button
                        disabled={!file || !trimmedName || nameInvalid || busy}
                        loading={busy}
                        size="sm"
                        variant="solid"
                        onClick={() => void handleUpload()}
                    >
                        Add emoji
                    </Button>
                </Stack>
                {(error || nameInvalid) && (
                    <Typography color="danger" level="body-xs" sx={{ mt: 0.75 }}>
                        {error ?? "Names are 1-50 chars of a-z, 0-9, _, + or -."}
                    </Typography>
                )}
            </Sheet>

            {/* Emoji grid */}
            {teamEmoji.length === 0 ? (
                <Typography level="body-sm" sx={{ opacity: 0.7, textAlign: "center", py: 2 }}>
                    {loading ? "Loading…" : "No custom emoji yet. Add the first one!"}
                </Typography>
            ) : (
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: 1,
                    }}
                >
                    {teamEmoji.map((e) => {
                        const uploader = e.createdBy ? teamMemberProfiles[e.createdBy] : undefined;
                        const isMine = e.createdBy === myself.userId;
                        return (
                            <Sheet
                                key={e.emojiId}
                                sx={{
                                    p: 1,
                                    borderRadius: "md",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    border: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.06)",
                                }}
                            >
                                <CustomEmojiImg name={e.name} size={28} url={e.url} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography level="body-sm" sx={{ fontWeight: 600 }} noWrap>
                                        :{e.name}:
                                    </Typography>
                                    <Typography level="body-xs" sx={{ opacity: 0.7 }} noWrap>
                                        {uploader?.userName ?? "—"}
                                        {e.tsCreatedAt
                                            ? ` · ${new Date(e.tsCreatedAt).toLocaleDateString()}`
                                            : ""}
                                    </Typography>
                                </Box>
                                {isMine && (
                                    <AppTooltip size="sm" title="Delete (old messages keep it)">
                                        <IconButton
                                            color="danger"
                                            data-testid={`delete-team-emoji-${e.name}`}
                                            size="sm"
                                            variant="plain"
                                            onClick={() => void remove(e.emojiId)}
                                        >
                                            <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </AppTooltip>
                                )}
                            </Sheet>
                        );
                    })}
                </Box>
            )}
        </Sheet>
    );
};
