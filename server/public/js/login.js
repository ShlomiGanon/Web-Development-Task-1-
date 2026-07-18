// Login page: validates credentials and starts a session.

import { lockUi, unlockUi, showMessage, showErrorMessage, goToLink } from './ui.js';
import { InputRule, validateForm, isValidEmail, isValidPhone, isValidPassword } from './validation.js';
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, Backend } from './constants.js';
import { ClientSessionManager } from './core/session.js';

const loginButton = document.getElementById('login-button');
const getCodeButton = document.getElementById('get-code-button');
const rememberMeCheckbox = document.getElementById('remember-me-checkbox');
const forgotPasswordButton = document.getElementById('forgot-pass-button');

const emailOrPhoneInput = document.getElementById('email-or-phone-field');
const passwordInput = document.getElementById('password-field');

loginButton.addEventListener('click', handleLoginClick);
getCodeButton.addEventListener('click', handleGetCodeClick);
forgotPasswordButton.addEventListener('click', handleForgotPassClick);

async function handleLoginClick()
{
    const isNotEmpty = (text) => text !== "";
    const isValidEmailOrPhone = (text) => isValidEmail(text) || isValidPhone(text);

    const rules =
    [
        new InputRule(emailOrPhoneInput, "Email or phone is required.", isNotEmpty),
        new InputRule(emailOrPhoneInput, "Enter a valid email or phone number.", isValidEmailOrPhone),
        new InputRule(passwordInput, "Password is required.", isNotEmpty),
        new InputRule(passwordInput, `Password length must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`, isValidPassword)
    ];

    if (!validateForm(rules))
    {
        return;
    }

    lockUi(loginButton);
    showMessage("Signing in...");

    try
    {
        const emailOrPhoneValue = emailOrPhoneInput.value;
        const passwordValue = passwordInput.value;
        const rememberMe = rememberMeCheckbox.checked;

        const response = await Backend.login(emailOrPhoneValue, passwordValue);

        if (response && response.success)
        {
            ClientSessionManager.setSessionToken(response.token, rememberMe);
            showMessage("Signed in successfully.");
            goToLink('../html/profiles.html');
        }
        else
        {
            const errorMessage = response ? response.message : "Sign in failed. Please try again later.";
            showErrorMessage(errorMessage);
            unlockUi();
        }
    }
    catch (error)
    {
        // Backend.login() handles normal failures; reaching here means an unexpected error.
        console.error("Login crashed:", error);
        showErrorMessage("Could not reach the server. Please try again.");
        unlockUi();
    }
}

function handleGetCodeClick()
{
    showErrorMessage("Sign in with a code is not available.");
}

function handleForgotPassClick()
{
    showErrorMessage("Password reset is not available.");
}
