const loginBtn = document.getElementById('login-button');
const getCodeBtn = document.getElementById('get-code-button');
const rememberMeCheckbox = document.getElementById('remember-me-checkbox');
const forgotPassButton = document.getElementById('forgot-pass-button');

const emailInput = document.getElementById('email-field');
const passwordInput = document.getElementById('password-field');
loginBtn.addEventListener('click', Login_Click);
getCodeBtn.addEventListener('click', GetCode_Click);
forgotPassButton.addEventListener('click', ForgotPass_Click);

function Login_Click() 
{
    const msg = "login-information ->\n" + 
    "email: [" + emailInput.value + "]\n" + 
    "password: [" + passwordInput.value + "]\n" +
    "remember-me: [" + rememberMeCheckbox.checked + "]";
    alert(msg);
}

function GetCode_Click() 
{
    const msg = "get-code-information ->\n" + 
    "email: [" + emailInput.value + "]";
    alert(msg);
}

function ForgotPass_Click() 
{
    window.location.href = '../html/no_support.html';
}