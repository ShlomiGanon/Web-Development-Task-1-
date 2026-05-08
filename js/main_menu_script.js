const loginBtn = document.getElementById('login-button');
const getCodeBtn = document.getElementById('get-code-button');
const emailInput = document.getElementById('email-field');
const passwordInput = document.getElementById('password-field');
const rememberMeCheckbox = document.getElementById('remember-me-checkbox');
loginBtn.addEventListener('click', Login_Click);
getCodeBtn.addEventListener('click', GetCode_Click);

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