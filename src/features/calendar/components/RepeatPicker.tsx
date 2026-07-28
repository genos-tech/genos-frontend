import {
    Box,
    Chip,
    FormControl,
    FormHelperText,
    FormLabel,
    Input,
    Option,
    Select,
    Stack,
} from "@mui/joy";
import dayjs from "dayjs";

import { useTranslation } from "../../../i18n";
import { RRULE_WEEKDAYS, type RecurrenceSpec, type RepeatFrequency } from "../utils/rrule";

interface RepeatPickerProps {
    value: RecurrenceSpec;
    onChange: (next: RecurrenceSpec) => void;
    /** The event's start date ("YYYY-MM-DD" or an ISO datetime). Used to
     *  seed the weekly day selection and to floor the until-date, so the
     *  rule can't end before the series begins. */
    startISO: string;
    /** Editing an existing series edits EVERY occurrence, so the control
     *  is disabled unless the user has opted into that scope. */
    disabled?: boolean;
}

const FREQUENCIES: RepeatFrequency[] = ["none", "daily", "weekly", "monthly", "yearly"];

/**
 * Repeat controls for the event modal.
 *
 * Progressive: a single "Does not repeat" select until the user picks a
 * frequency, then the interval, the weekly day chips, and the end
 * condition appear. A form that showed all of it up-front would be five
 * extra rows on the overwhelmingly common one-off event.
 */
export const RepeatPicker = ({
    value,
    onChange,
    startISO,
    disabled = false,
}: RepeatPickerProps) => {
    const { t } = useTranslation();
    const repeats = value.frequency !== "none";
    const startDay = startISO ? dayjs(startISO) : null;
    const startDate = startDay?.isValid() ? startDay.format("YYYY-MM-DD") : undefined;

    const set = (patch: Partial<RecurrenceSpec>) => onChange({ ...value, ...patch });

    const toggleWeekday = (day: number) => {
        const next = value.byWeekday.includes(day)
            ? value.byWeekday.filter((d) => d !== day)
            : [...value.byWeekday, day];
        set({ byWeekday: next });
    };

    return (
        <Stack spacing={1}>
            <FormControl>
                <FormLabel>{t.calendar.repeat.label}</FormLabel>
                <Select
                    disabled={disabled}
                    value={value.frequency}
                    onChange={(_e, next) => {
                        if (!next) return;
                        // Seed the weekly chips from the start date so the
                        // first occurrence lands on the day the user
                        // actually picked. An empty BYDAY would work too
                        // (Google infers it), but showing the day selected
                        // makes the rule legible.
                        const byWeekday =
                            next === "weekly" &&
                            value.byWeekday.length === 0 &&
                            startDay?.isValid()
                                ? [startDay.day()]
                                : value.byWeekday;
                        set({ frequency: next, byWeekday });
                    }}
                >
                    {FREQUENCIES.map((freq) => (
                        <Option key={freq} value={freq}>
                            {t.calendar.repeat.frequency[freq]}
                        </Option>
                    ))}
                </Select>
            </FormControl>

            {repeats && (
                <>
                    <FormControl>
                        <FormLabel>{t.calendar.repeat.every}</FormLabel>
                        <Input
                            disabled={disabled}
                            slotProps={{ input: { min: 1, max: 999 } }}
                            type="number"
                            value={value.interval}
                            endDecorator={t.calendar.repeat.unit[value.frequency]}
                            onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10);
                                set({
                                    interval: Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
                                });
                            }}
                        />
                    </FormControl>

                    {value.frequency === "weekly" && (
                        <FormControl>
                            <FormLabel>{t.calendar.repeat.onDays}</FormLabel>
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                {RRULE_WEEKDAYS.map((_code, day) => {
                                    const selected = value.byWeekday.includes(day);
                                    return (
                                        <Chip
                                            key={day}
                                            color={selected ? "primary" : "neutral"}
                                            disabled={disabled}
                                            size="sm"
                                            variant={selected ? "solid" : "outlined"}
                                            sx={{ minWidth: 34, justifyContent: "center" }}
                                            onClick={() => toggleWeekday(day)}
                                        >
                                            {dayjs().day(day).format("dd")}
                                        </Chip>
                                    );
                                })}
                            </Box>
                            {value.byWeekday.length === 0 && (
                                <FormHelperText>{t.calendar.repeat.noDaysHelper}</FormHelperText>
                            )}
                        </FormControl>
                    )}

                    <FormControl>
                        <FormLabel>{t.calendar.repeat.ends}</FormLabel>
                        <Select
                            disabled={disabled}
                            value={value.end.kind}
                            onChange={(_e, next) => {
                                if (!next) return;
                                if (next === "never") set({ end: { kind: "never" } });
                                else if (next === "afterCount")
                                    set({ end: { kind: "afterCount", count: 10 } });
                                else
                                    set({
                                        end: {
                                            kind: "onDate",
                                            // Default a month out rather than
                                            // today, which would produce a
                                            // series with one occurrence.
                                            date:
                                                startDay?.isValid() === true
                                                    ? startDay.add(1, "month").format("YYYY-MM-DD")
                                                    : dayjs().add(1, "month").format("YYYY-MM-DD"),
                                        },
                                    });
                            }}
                        >
                            <Option value="never">{t.calendar.repeat.endNever}</Option>
                            <Option value="onDate">{t.calendar.repeat.endOnDate}</Option>
                            <Option value="afterCount">{t.calendar.repeat.endAfter}</Option>
                        </Select>
                    </FormControl>

                    {value.end.kind === "onDate" && (
                        <FormControl>
                            <Input
                                disabled={disabled}
                                type="date"
                                value={value.end.date}
                                // Floored at the start date: an earlier
                                // UNTIL yields a series with no occurrences
                                // at all, which looks like the save failed.
                                slotProps={{ input: { min: startDate } }}
                                onChange={(e) =>
                                    set({ end: { kind: "onDate", date: e.target.value } })
                                }
                            />
                            <FormHelperText>{t.calendar.repeat.endOnDateHelper}</FormHelperText>
                        </FormControl>
                    )}

                    {value.end.kind === "afterCount" && (
                        <FormControl>
                            <Input
                                disabled={disabled}
                                endDecorator={t.calendar.repeat.occurrences}
                                slotProps={{ input: { min: 1, max: 730 } }}
                                type="number"
                                value={value.end.count}
                                onChange={(e) => {
                                    const parsed = parseInt(e.target.value, 10);
                                    set({
                                        end: {
                                            kind: "afterCount",
                                            count:
                                                Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
                                        },
                                    });
                                }}
                            />
                        </FormControl>
                    )}
                </>
            )}
        </Stack>
    );
};
