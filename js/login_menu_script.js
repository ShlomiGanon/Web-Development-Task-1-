import * as UI from './ui-utils.js';
import * as Auth from './auth.js';
import * as Config from './config.js';
//button variables
const loginBtn = document.getElementById('login-button');
const getCodeBtn = document.getElementById('get-code-button');
const rememberMeCheckbox = document.getElementById('remember-me-checkbox');
const forgotPassButton = document.getElementById('forgot-pass-button');
//input variables
const emailOrPhoneInput = document.getElementById('email-or-phone-field');
const passwordInput = document.getElementById('password-field');
//event listeners
loginBtn.addEventListener('click', Login_Click);//login button event listener
getCodeBtn.addEventListener('click', GetCode_Click);//get code button event listener
forgotPassButton.addEventListener('click', ForgotPass_Click);//forgot password button event listener


async function Login_Click() //login button function
{
    
    const is_not_empty = (text) => text !== "";
    const is_valid_email_or_phone = (text) => Auth.Is_Valid_Email(text) || Auth.Is_Valid_Phone(text);

    const rules = 
    [
        new Auth.InputRule(emailOrPhoneInput, "אימייל או טלפון הוא שדה חובה", is_not_empty),
        new Auth.InputRule(emailOrPhoneInput, "לא נמצא אימייל או נייד תקין", is_valid_email_or_phone),
        new Auth.InputRule(passwordInput, "סיסמה היא שדה חובה", is_not_empty),
        new Auth.InputRule(passwordInput, `אורך סיסמה לא תקין [${Config.MIN_PASSWORD_LENGTH}-${Config.MAX_PASSWORD_LENGTH}]`, Auth.Is_Valid_Password)
    ];

    
    if (!Auth.ValidateForm(rules)) return;//if the form is invalid we stop the function


    UI.LockUI(loginBtn);
    UI.ShowMessage("ממתין לתגובה מהשרת...");
    let response = null;
    if(Auth.Is_Valid_Email(emailOrPhoneInput.value))
    {
        response = await Auth.Login_By_Email(emailOrPhoneInput.value, passwordInput.value);
    }
    else if(Auth.Is_Valid_Phone(emailOrPhoneInput.value))
    {
        response = await Auth.Login_By_Phone(emailOrPhoneInput.value, passwordInput.value);
    }

    if(response.success)
    {
        UI.ShowMessage("התחברות בוצעה בהצלחה");
        setTimeout(UI.GoToLink, 2000, '../html/profiles.html');//wait for 2 seconds and then go to the profiles page
        // UI remains locked during navigation to prevent duplicate submissions.
        // Page memory will be cleared automatically by the browser upon redirection.
    }
    else
    {
        UI.ShowErrorMessage(response.message);
        UI.UnlockUI();//unlock the ui only if the login failed
    }
}

function GetCode_Click() //get code button function
{
    UI.ShowErrorMessage("אין אפשרות לכניסה עם קוד, נסה שנית");
}

function ForgotPass_Click() //forgot password button function
{
    UI.ShowErrorMessage("אין אפשרות לאיפוס סיסמה, נסה שנית");
}