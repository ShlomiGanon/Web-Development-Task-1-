import * as UI from './ui-utils.js';
import * as Constants from './constances.js';

export function is_valid_birthday(birthday)
{
    const birthdayDate = new Date(birthday);
    const today = new Date();
    return birthdayDate < today;
}

export function is_valid_name(name)
{
    return /^[a-zA-Z]+$/.test(name);
}

export function Is_Valid_Email(email)
{
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

export function Is_Valid_Phone(phone)
{
    const phoneRegex = /^05[0-9]{8}$/;
    return phoneRegex.test(phone);
}

export function Is_Valid_Password(password,minLength = Constants.MIN_PASSWORD_LENGTH,maxLength = Constants.MAX_PASSWORD_LENGTH)
{
    if(password.length < minLength || password.length > maxLength)return false;
    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/;
    return passwordRegex.test(password);
}

//a class to validate an input
export class InputRule 
{
    //element: the input element to validate
    //ruleFn: the function to validate the input (must return a boolean)
    //message: the message to show if the input is invalid
    //params: the parameters to pass to the rule function
    constructor(element, message, ruleFn, params = []) 
    {
        this.element = element;
        this.message = message;
        this.rule = ruleFn;
        this.params = params;
    }
    //validate the input and return true if the input is valid, false otherwise
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
 * @note Rules must be ordered Top-to-Bottom based on their UI position to ensure 
 * logical focus flow and message sequence.
 * 
 * @features
 * - Aggregates all error messages into a single report.
 * - One error per element: Skips subsequent rules for an element once it fails.
 * - Auto-focuses the first invalid input encountered.
 * 
 * @param {Array} rules - Array of Auth.InputRule objects.
 * @returns {boolean} - True if valid; False if errors were found.
 */
export function ValidateForm(rules) 
{
    let firstInvalidRule = null;//the first invalid rule to focus on it
    let errorMessages = []; //the messages to show if the form is invalid (to show them all at once)
    const failedElements = new Set();//the elements that have failed validation (to not check them again)
    for (const r of rules)
    {
        if(failedElements.has(r.element)) continue;
        if (!r.isValid()) 
        {
            if (!firstInvalidRule) 
            {
                firstInvalidRule = r;
            }
            errorMessages.push(r.message);
            failedElements.add(r.element);
        }
    }

    if (firstInvalidRule)
    {
        const finalMsg = errorMessages.join("\n");
        UI.ShowErrorMessage(finalMsg);
        firstInvalidRule.element.focus();
        return false;
    }

    return true;
}