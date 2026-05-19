/**
 * Pure password-strength rules used by SignUpForm. Kept free of React /
 * i18n so the same function can be reused by a future password-reset
 * flow without dragging UI deps along.
 *
 * Rules deliberately stricter than the backend's Django defaults
 * (length + not-all-numeric) so a UI-clean password always survives
 * server-side validation. See backend_django/apis/settings.py.
 */

export interface PasswordValidationResult {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    score: 0 | 1 | 2 | 3 | 4;
    isValid: boolean;
}

export const MIN_PASSWORD_LENGTH = 8;

export const validatePassword = (pw: string): PasswordValidationResult => {
    const length = pw.length >= MIN_PASSWORD_LENGTH;
    const uppercase = /[A-Z]/.test(pw);
    const lowercase = /[a-z]/.test(pw);
    const number = /[0-9]/.test(pw);
    const score = (Number(length) + Number(uppercase) + Number(lowercase) + Number(number)) as
        | 0
        | 1
        | 2
        | 3
        | 4;
    return { length, uppercase, lowercase, number, score, isValid: score === 4 };
};
