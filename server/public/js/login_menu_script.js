import * as UI from './ui-utils.js';
import * as Auth from './auth.js';
import * as Constants from './constances.js';
import { ClientSessionManager } from './client-session-manager.js';
import { Backend } from './config.js';

const loginButton = document.getElementById('login-button');
const getCodeButton = document.getElementById('get-code-button');
const rememberMeCheckbox = document.getElementById('remember-me-checkbox');
const forgotPasswordButton = document.getElementById('forgot-pass-button');

const emailOrPhoneInput = document.getElementById('email-or-phone-field');
const passwordInput = document.getElementById('password-field');

loginButton.addEventListener('click', Login_Click);
getCodeButton.addEventListener('click', GetCode_Click);
forgotPasswordButton.addEventListener('click', ForgotPass_Click);

async function Login_Click()
{
    const isNotEmpty = (text) => text !== "";
    const isValidEmailOrPhone = (text) => Auth.Is_Valid_Email(text) || Auth.Is_Valid_Phone(text);

    const rules =
    [
        new Auth.InputRule(emailOrPhoneInput, "אימייל או טלפון הוא שדה חובה", isNotEmpty),
        new Auth.InputRule(emailOrPhoneInput, "לא נמצא אימייל או נייד תקין", isValidEmailOrPhone),
        new Auth.InputRule(passwordInput, "סיסמה היא שדה חובה", isNotEmpty),
        new Auth.InputRule(passwordInput, `אורך סיסמה לא תקין [${Constants.MIN_PASSWORD_LENGTH}-${Constants.MAX_PASSWORD_LENGTH}]`, Auth.Is_Valid_Password)
    ];

    if (!Auth.ValidateForm(rules))
    {
        return;
    }

    UI.LockUI(loginButton);
    UI.ShowMessage("ממתין לתגובה מהשרת...");

    try
    {
        const emailOrPhoneValue = emailOrPhoneInput.value;
        const passwordValue = passwordInput.value;
        const rememberMe = rememberMeCheckbox.checked;

        const response = await Backend.login(emailOrPhoneValue, passwordValue);

        if (response && response.success)
        {
            ClientSessionManager.setSessionToken(response.token, rememberMe);
            UI.ShowMessage("התחברות בוצעה בהצלחה");
            // Short delay so the success message is visible before navigating away.
            setTimeout(() =>
            {
                UI.GoToLink('../html/profiles.html');
            }, 2000);
        }
        else
        {
            const errorMsg = response ? response.message : "שגיאה בהתחברות, נסה שנית מאוחר יותר";
            UI.ShowErrorMessage(errorMsg);
            UI.UnlockUI();
        }
    }
    catch (error)
    {
        // Backend.login() already catches network/server errors internally and resolves
        // with { success: false }, so reaching this catch means something unexpected happened
        // (e.g. a bug in the code above), not a normal login failure.
        console.error("Login crashed:", error);
        UI.ShowErrorMessage("תקלת תקשורת מול השרת. אנא נסה שוב.");
        UI.UnlockUI();
    }
}

function GetCode_Click()
{
    UI.ShowErrorMessage("אין אפשרות לכניסה עם קוד, נסה שנית");
}

function ForgotPass_Click()
{
    UI.ShowErrorMessage("אין אפשרות לאיפוס סיסמה, נסה שנית");
}