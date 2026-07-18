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
        new InputRule(emailOrPhoneInput, "אימייל או טלפון הוא שדה חובה", isNotEmpty),
        new InputRule(emailOrPhoneInput, "לא נמצא אימייל או נייד תקין", isValidEmailOrPhone),
        new InputRule(passwordInput, "סיסמה היא שדה חובה", isNotEmpty),
        new InputRule(passwordInput, `אורך סיסמה לא תקין [${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH}]`, isValidPassword)
    ];

    if (!validateForm(rules))
    {
        return;
    }

    lockUi(loginButton);
    showMessage("ממתין לתגובה מהשרת...");

    try
    {
        const emailOrPhoneValue = emailOrPhoneInput.value;
        const passwordValue = passwordInput.value;
        const rememberMe = rememberMeCheckbox.checked;

        const response = await Backend.login(emailOrPhoneValue, passwordValue);

        if (response && response.success)
        {
            ClientSessionManager.setSessionToken(response.token, rememberMe);
            showMessage("התחברות בוצעה בהצלחה");
            goToLink('../html/profiles.html');
        }
        else
        {
            const errorMessage = response ? response.message : "שגיאה בהתחברות, נסה שנית מאוחר יותר";
            showErrorMessage(errorMessage);
            unlockUi();
        }
    }
    catch (error)
    {
        // Backend.login() handles normal failures; reaching here means an unexpected error.
        console.error("Login crashed:", error);
        showErrorMessage("תקלת תקשורת מול השרת. אנא נסה שוב.");
        unlockUi();
    }
}

function handleGetCodeClick()
{
    showErrorMessage("אין אפשרות לכניסה עם קוד, נסה שנית");
}

function handleForgotPassClick()
{
    showErrorMessage("אין אפשרות לאיפוס סיסמה, נסה שנית");
}
