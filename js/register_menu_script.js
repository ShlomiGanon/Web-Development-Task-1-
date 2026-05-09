const emailInput = document.getElementById('mail-field');
const phoneInput = document.getElementById('phone-field');
const passwordInput = document.getElementById('password-field');
const confirmPasswordInput = document.getElementById('confirm-password-field');
const registerBtn = document.getElementById('register-button');

registerBtn.addEventListener('click', Register_Click);

function Register_Click() 
{
    LockUI(registerBtn);
    
    const msg = "register-information ->\n" + 
    "email: [" + emailInput.value + "]\n" + 
    "phone: [" + phoneInput.value + "]\n" + 
    "password: [" + passwordInput.value + "]\n" + 
    "confirm-password: [" + confirmPasswordInput.value + "]";
    console.log(msg);

    setTimeout(UnlockUI, 2000);
}