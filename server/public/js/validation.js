// Form validation rules and helpers shared by the login and register pages.

import { showErrorMessage } from './ui.js';
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from './constants.js';

export function isValidBirthday(birthday)
{
    const birthdayDate = new Date(birthday);
    const today = new Date();
    return birthdayDate < today;
}

export function isValidName(name)
{
    if (!name || name.length < 1) return false;
    return /^[a-zA-Z]+$/.test(name);
}

export function isValidEmail(email)
{
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

export function isValidPhone(phone)
{
    const phoneRegex = /^05[0-9]{8}$/;
    return phoneRegex.test(phone);
}

export function isValidPassword(password, minLength = MIN_PASSWORD_LENGTH, maxLength = MAX_PASSWORD_LENGTH)
{
    if (password.length < minLength || password.length > maxLength) return false;
    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/;
    return passwordRegex.test(password);
}

// One validation rule bound to an input element.
export class InputRule
{
    constructor(element, message, ruleFn, params = [])
    {
        this.element = element;
        this.message = message;
        this.rule = ruleFn;
        this.params = params;
    }

    // Toggles the is-invalid class and returns whether the value passes.
    isValid()
    {
        const value = this.element.value;
        const result = this.rule(value, ...this.params);

        if (!result)
        {
            this.element.classList.add('is-invalid');
        }
        else
        {
            this.element.classList.remove('is-invalid');
        }

        return result;
    }
}

/**
 * Validates form rules and manages UI error reporting.
 *
 * @note Rules must be ordered top-to-bottom based on their UI position to ensure logical
 * focus flow and message sequence.
 *
 * - Aggregates all error messages into a single report.
 * - One error per element: skips subsequent rules for an element once it fails.
 * - Auto-focuses the first invalid input encountered.
 *
 * @param {Array} rules - Array of InputRule objects.
 * @returns {boolean} - True if valid; false if errors were found.
 */
export function validateForm(rules)
{
    let firstInvalidRule = null;
    let errorMessages = [];
    const failedElements = new Set(); // skip further rules for an already-failed element

    for (const rule of rules)
    {
        if (failedElements.has(rule.element)) continue;
        if (!rule.isValid())
        {
            if (!firstInvalidRule)
            {
                firstInvalidRule = rule;
            }
            errorMessages.push(rule.message);
            failedElements.add(rule.element);
        }
    }

    if (firstInvalidRule)
    {
        const finalMessage = errorMessages.join("\n");
        showErrorMessage(finalMessage);
        firstInvalidRule.element.focus();
        return false;
    }

    return true;
}
