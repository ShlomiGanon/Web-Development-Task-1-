import * as UI from './ui-utils.js';
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 16;

//the active user
let activeUser = null;

//a class to store the user information
class User_Information
{
    constructor(email , profiles_data = [])
    {
        this.email = email;
        this.profiles_data = profiles_data;
    }
    
    //getters

    get_email()
    {
        return this.email;
    }

    get_profile(id)
    {
        return this.profiles_data.find(profile => profile.id === id);
    }

    get_all_profiles()
    {
        return this.profiles_data;
    }

    //add or remove profiles

    add_profile(id, name, imageName)
    {
        this.profiles_data.push(new Profile(id, name, imageName));
    }

    remove_profile(id)
    {
        this.profiles_data = this.profiles_data.filter(profile => profile.id !== id);
    }
    
}


export async function Login_By_Email(email , password)
{
    await new Promise(resolve => setTimeout(resolve, 2000)); //simulate a login process (for two seconds)

    return { success: true };
}

export async function Login_By_Phone(phone , password)
{
    await new Promise(resolve => setTimeout(resolve, 2000)); //simulate a login process (for two seconds)

    return { success: true };
}

export function Register(full_name , email , phone , password)
{
    return; //not implemented
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

export function Is_Valid_Password(password,minLength,maxLength)
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