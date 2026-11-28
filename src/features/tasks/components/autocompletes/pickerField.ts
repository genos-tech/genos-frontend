// What a form outside the task view says about a picker it borrows: the picker looks and
// behaves as it does there, and still carries that form's name, error and focus target.

export type PickerField = {
    /** The accessible name, where no visible label stands beside the picker. */
    label: string;
    invalid?: boolean;
    describedBy?: string;
    /** `data-slot`: what the form moves the focus to. */
    slotId?: string;
};

/** For the Autocomplete's `slotProps.input`; nothing without a `field`. */
export const pickerInputProps = (field?: PickerField) =>
    field
        ? {
              "aria-label": field.label,
              "aria-invalid": field.invalid || undefined,
              "aria-describedby": field.describedBy,
              "data-slot": field.slotId,
          }
        : {};
