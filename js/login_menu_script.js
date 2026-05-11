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


function Login_Click() 
{
    UI.LockUI(loginBtn);

    const msg = "login-information ->\n" + 
    "email or phone: [" + emailOrPhoneInput.value + "]\n" + 
    "password: [" + passwordInput.value + "]\n" +
    "remember-me: [" + rememberMeCheckbox.checked + "]";
    console.log(msg);
    if(emailOrPhoneInput.value == "" && passwordInput.value == "")
    {
        UI.ShowMessage("Email or phone and password are required");
        UI.UnlockUI();
        return;
    }
    else if(emailOrPhoneInput.value == "")
    {
        UI.ShowMessage("Email or phone is required");
        UI.UnlockUI();
        return;
    }
    else if(passwordInput.value == "")
    {
        UI.ShowMessage("Password is required");
        UI.UnlockUI();
        return;
    }
    else
    {
        UI.ShowMessage("Login successful");
    }
    //simulate a login process by sleeping for 2 seconds
    let timer = setTimeout(() => 
    {
        UI.UnlockUI();
        UI.ClearMessage();
        UI.GoToLink('../html/profiles.html');//simulate successful login
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