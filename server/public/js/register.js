// Register page: validates the sign-up form and creates a new account.

import { lockUi, unlockUi, showMessage, showErrorMessage, goToLink } from './ui.js';
import { InputRule, validateForm, isValidName, isValidEmail, isValidPhone, isValidPassword, isValidBirthday } from './validation.js';
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, Backend } from './constants.js';

const fullNameInput = document.getElementById('full-name-field');
const birthdayInput = document.getElementById('birthday-field');
const emailInput = document.getElementById('mail-field');
const phoneInput = document.getElementById('phone-field');
const passwordInput = document.getElementById('password-field');
const confirmPasswordInput = document.getElementById('confirm-password-field');
const registerButton = document.getElementById('register-button');
registerButton.addEventListener('click', handleRegisterClick);

async function handleRegisterClick()
{
    const isNotEmpty = (text) => text !== "";
    const isValidFullName = (text) => isValidName(text.split(' ')[0]) && isValidName(text.split(' ')[1]);
    const rules =
    [
        new InputRule(fullNameInput, "Full name is required.", isNotEmpty),
        new InputRule(fullNameInput, "Enter a valid first and last name.", isValidFullName),
        new InputRule(birthdayInput, "Birthday is required.", isNotEmpty),
        new InputRule(birthdayInput, "Enter a valid birthday.", isValidBirthday),
        new InputRule(emailInput, "Email is required.", isNotEmpty),
        new InputRule(emailInput, "Enter a valid email.", isValidEmail),
        new InputRule(phoneInput, "Phone number is required.", isNotEmpty),
        new InputRule(phoneInput, "Enter a valid phone number.", isValidPhone),
        new InputRule(passwordInput, "Password is required.", isNotEmpty),
        new InputRule(passwordInput, `Password length must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`, isValidPassword, [MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH]),
        new InputRule(confirmPasswordInput, "Confirm password is required.", isNotEmpty),
        new InputRule(confirmPasswordInput, "Passwords do not match.", (text) => text === passwordInput.value),
    ];

    if (!validateForm(rules))
    {
        return;
    }

    lockUi(registerButton);
    showMessage("Creating your account...");

    try
    {
        // Backend only stores a single fullName field and splits it on the first space
        // (word 1 = firstName, word 2 = lastName), so first/last must be joined this way.
        const fullNameValue = fullNameInput.value.trim();

        const response = await Backend.register(
            emailInput.value.trim(),
            phoneInput.value.trim(),
            passwordInput.value,
            fullNameValue,
            birthdayInput.value.trim()
        );

        if (response && response.success)
        {
            showMessage("Account created. Taking you to Sign In...");
            goToLink('../html/login.html');
        }
        else
        {
            const errorMessage = response ? response.message : "Sign up failed. Please try again.";
            showErrorMessage(errorMessage);
            unlockUi();
        }
    }
    catch (error)
    {
        console.error("Registration crashed:", error);
        showErrorMessage("Could not reach the server. Please try again.");
        unlockUi();
    }
}
