import * as UI from './ui-utils.js';
const loginBtn = document.getElementById('login-button');
const getCodeBtn = document.getElementById('get-code-button');
const rememberMeCheckbox = document.getElementById('remember-me-checkbox');
const forgotPassButton = document.getElementById('forgot-pass-button');

const emailOrPhoneInput = document.getElementById('email-or-phone-field');
const passwordInput = document.getElementById('password-field');
loginBtn.addEventListener('click', Login_Click);
getCodeBtn.addEventListener('click', GetCode_Click);
forgotPassButton.addEventListener('click', ForgotPass_Click);
// Remove 'is-invalid' class on input for better ux
[emailOrPhoneInput, passwordInput].forEach(input => 
    {
    input.addEventListener('input', () => 
        {
            input.classList.remove('is-invalid');
            UI.ClearMessage();
        });
    }
);


function Login_Click() 
{
    UI.LockUI(loginBtn);

    emailOrPhoneInput.classList.remove('is-invalid');
    passwordInput.classList.remove('is-invalid');

    const emailVal = emailOrPhoneInput.value.trim();
    const passVal = passwordInput.value.trim();

    if (emailVal === "" || passVal === "") 
    {
        UI.UnlockUI();
        
        if (emailVal === "" && passVal === "") 
        {
            UI.ShowErrorMessage("חובה למלא את שדות האימייל (או הטלפון) והסיסמה.");
            emailOrPhoneInput.classList.add('is-invalid');
            passwordInput.classList.add('is-invalid');
            emailOrPhoneInput.focus();
        } 
        else if (emailVal === "") 
        {
            UI.ShowErrorMessage("אימייל או טלפון הינו שדה חובה");
            emailOrPhoneInput.classList.add('is-invalid');
            emailOrPhoneInput.focus();
        } 
        else 
        {
            UI.ShowErrorMessage("סיסמה הינה שדה חובה");
            passwordInput.classList.add('is-invalid');
            passwordInput.focus();
        }
        return;
    }

    // 3. הצלחה
    UI.ShowMessage("התחברות בוצעה בהצלחה");
    
    setTimeout(() => {
        UI.UnlockUI();
        UI.ClearMessage();
        UI.GoToLink('../html/profiles.html');
    }, 2000);
}

function GetCode_Click() 
{
    UI.LockUI(getCodeBtn);
    
    const msg = "get-code-information ->\n" + 
    "email or phone: [" + emailOrPhoneInput.value + "]";
    console.log(msg);

    setTimeout(UI.UnlockUI, 2000);
}

function ForgotPass_Click() 
{
    //not implemented yet
    UI.GoToLink('../html/no_support.html');
}