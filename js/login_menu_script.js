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
    LockUI(loginBtn);

    const msg = "login-information ->\n" + 
    "email or phone: [" + emailOrPhoneInput.value + "]\n" + 
    "password: [" + passwordInput.value + "]\n" +
    "remember-me: [" + rememberMeCheckbox.checked + "]";
    console.log(msg);

    //simulate a login process by sleeping for 2 seconds
    setTimeout(UnlockUI, 2000);
}

function GetCode_Click() 
{
    LockUI(getCodeBtn);
    
    const msg = "get-code-information ->\n" + 
    "email or phone: [" + emailOrPhoneInput.value + "]";
    console.log(msg);

    setTimeout(UnlockUI, 2000);
}

function ForgotPass_Click() 
{
    //not implemented yet
    GoToLink('../html/no_support.html');
}