import { useEffect, useState } from "react";
import { FormControl, FormLabel, Radio, RadioGroup, Textarea, Typography } from "@mui/joy";

import { toast } from "../../../components/ui/feedback/toastStore";
import { ConfirmDialog } from "../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../context/authState";
import { useTranslation } from "../../../i18n";
import { GENOS_MEMORY_CONFIRM_Z_INDEX } from "../memory/confirmLayer";
import { REPORT_NOTE_MAX, REPORT_REASONS, reportSkill, type ReportReason } from "./skillsApi";

type Props = {
    /** The skill being reported, or null while the dialog is closed. */
    skill: { id: string; title: string } | null;
    onClose: () => void;
};

/**
 * "Report" on a skill someone else wrote (MIP-2044): a reason and an optional note. It opens from
 * the skill's own page and from its row in the list, so there is no page or section of its own. A
 * second report of the same skill is the same report (the server says so), so a double click or a
 * retry does no harm.
 */
export const SkillReportDialog = ({ skill, onClose }: Props) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const r = t.settings.genosSkills.report;
    const [reason, setReason] = useState<ReportReason | null>(null);
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!skill) {
            setReason(null);
            setNote("");
            setError(null);
        }
    }, [skill]);

    const send = async () => {
        if (!skill || !reason) return false;
        setError(null);
        const res = await reportSkill(accessToken, skill.id, reason, note);
        if (res.ok) {
            toast.success(r.sent);
            onClose();
            return true;
        }
        setError(res.reason === "report_limit" ? r.limit : res.message || r.failed);
        return false;
    };

    return (
        <ConfirmDialog
            cancelLabel={t.common.actions.cancel}
            confirmDisabled={reason === null}
            confirmLabel={r.send}
            description={r.body}
            entityName={skill?.title}
            error={error}
            open={skill !== null}
            title={r.title}
            zIndex={GENOS_MEMORY_CONFIRM_Z_INDEX}
            onClose={onClose}
            onConfirm={send}
        >
            <FormControl sx={{ mt: 1.5 }}>
                <FormLabel>{r.reasonLabel}</FormLabel>
                <RadioGroup
                    value={reason ?? ""}
                    onChange={(event) => setReason(event.target.value as ReportReason)}
                >
                    {REPORT_REASONS.map((value) => (
                        <Radio key={value} label={r.reasons[value]} size="sm" value={value} />
                    ))}
                </RadioGroup>
            </FormControl>
            <FormControl sx={{ mt: 1.5 }}>
                <FormLabel>{r.noteLabel}</FormLabel>
                <Textarea
                    maxRows={5}
                    minRows={2}
                    size="sm"
                    slotProps={{ textarea: { maxLength: REPORT_NOTE_MAX } }}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                />
                <Typography level="body-xs" sx={{ mt: 0.5, color: "text.tertiary" }}>
                    {note.length} / {REPORT_NOTE_MAX}
                </Typography>
            </FormControl>
        </ConfirmDialog>
    );
};
