import * as UI from './ui-utils.js';
import * as Auth from './auth.js';
import * as Constants from './constances.js';
import { ClientSessionManager } from './clientSessionManager.js';


const loginBtn = document.getElementById('login-button');
const getCodeBtn = document.getElementById('get-code-button');
const rememberMeCheckbox = document.getElementById('remember-me-checkbox');
const forgotPassButton = document.getElementById('forgot-pass-button');

const emailOrPhoneInput = document.getElementById('email-or-phone-field');
const passwordInput = document.getElementById('password-field');

loginBtn.addEventListener('click', Login_Click);
getCodeBtn.addEventListener('click', GetCode_Click);
forgotPassButton.addEventListener('click', ForgotPass_Click);

async function Login_Click() 
{
    const is_not_empty = (text) => text !== "";
    const is_valid_email_or_phone = (text) => Auth.Is_Valid_Email(text) || Auth.Is_Valid_Phone(text);

    const rules = 
    [
        new Auth.InputRule(emailOrPhoneInput, "אימייל או טלפון הוא שדה חובה", is_not_empty),
        new Auth.InputRule(emailOrPhoneInput, "לא נמצא אימייל או נייד תקין", is_valid_email_or_phone),
        new Auth.InputRule(passwordInput, "סיסמה היא שדה חובה", is_not_empty),
        new Auth.InputRule(passwordInput, `אורך סיסמה לא תקין [${Constants.MIN_PASSWORD_LENGTH}-${Constants.MAX_PASSWORD_LENGTH}]`, Auth.Is_Valid_Password)
    ];

    if (!Auth.ValidateForm(rules)) 
    {
        return;
    }

    UI.LockUI(loginBtn);
    UI.ShowMessage("ממתין לתגובה מהשרת...");
    
    try 
    {
        let response = null;
        const inputValue = emailOrPhoneInput.value;
        const passwordValue = passwordInput.value;
        const rememberMe = rememberMeCheckbox.checked;
        if (Auth.Is_Valid_Email(inputValue))
        {
            response = await ClientSessionManager.loginByEmail(inputValue, passwordValue , rememberMe);
        }
        else if (Auth.Is_Valid_Phone(inputValue))
        {
            response = await ClientSessionManager.loginByPhone(inputValue, passwordValue , rememberMe);
        }

        if (response && response.success)
        {
            UI.ShowMessage("התחברות בוצעה בהצלחה");
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