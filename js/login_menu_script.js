const loginBtn = document.getElementById('login-button');
const getCodeBtn = document.getElementById('get-code-button');
const rememberMeCheckbox = document.getElementById('remember-me-checkbox');
const forgotPassButton = document.getElementById('forgot-pass-button');

const moreInfoLink = document.getElementById('more-info-link');
const registerLink = document.getElementById('register-link');

const emailInput = document.getElementById('email-field');
const passwordInput = document.getElementById('password-field');
loginBtn.addEventListener('click', Login_Click);
getCodeBtn.addEventListener('click', GetCode_Click);
forgotPassButton.addEventListener('click', ForgotPass_Click);


function DisableButtons()
{
    //disable all buttons and input fields
    //to prevent multiple clicks
    loginBtn.disabled = true;
    getCodeBtn.disabled = true;
    forgotPassButton.disabled = true;
    moreInfoLink.style.pointerEvents = "none";
    registerLink.style.pointerEvents = "none";
    emailInput.disabled = true;
    passwordInput.disabled = true;
    rememberMeCheckbox.disabled = true;
}

function EnableButtons()
{
    //enable all buttons and input fields
    loginBtn.disabled = false;
    getCodeBtn.disabled = false;
    forgotPassButton.disabled = false;
    moreInfoLink.style.pointerEvents = "auto";
    registerLink.style.pointerEvents = "auto";
    emailInput.disabled = false;
    passwordInput.disabled = false;
    rememberMeCheckbox.disabled = false;
}

function Login_Click() 
{
    DisableButtons();

    const msg = "login-information ->\n" + 
    "email: [" + emailInput.value + "]\n" + 
    "password: [" + passwordInput.value + "]\n" +
    "remember-me: [" + rememberMeCheckbox.checked + "]";
    console.log(msg);

    //simulate a login process by sleeping for 2 seconds
    setTimeout(EnableButtons , 2000);
}

function GetCode_Click() 
{
    DisableButtons();
    
    const msg = "get-code-information ->\n" + 
    "email: [" + emailInput.value + "]";
    console.log(msg);

    setTimeout(EnableButtons , 2000);
}

function ForgotPass_Click() 
{
    //not implemented yet
    window.location.href = '../html/no_support.html';
}