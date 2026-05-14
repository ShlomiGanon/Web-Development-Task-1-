import * as UI from './ui-utils.js';
const emailInput = document.getElementById('mail-field');
const phoneInput = document.getElementById('phone-field');
const passwordInput = document.getElementById('password-field');
const confirmPasswordInput = document.getElementById('confirm-password-field');
const registerBtn = document.getElementById('register-button');

registerBtn.addEventListener('click', Register_Click);//register button event listener
// Remove 'is-invalid' class on input for better ux
[emailInput, phoneInput, passwordInput, confirmPasswordInput].forEach(input => 
    {
    input.addEventListener('input', () => 
        {
            input.classList.remove('is-invalid');
            UI.ClearMessage();
        });
    }
);

function Register_Click() //register button function
{
    const inputs = [emailInput, phoneInput, passwordInput, confirmPasswordInput];

    inputs.forEach(input => 
        {
            input.classList.remove('is-invalid');
        });
    UI.ClearMessage();

    

    if(passVal !== confirmPassVal)
    {
        UI.ShowErrorMessage("הסיסמאות אינן זהות");
        passwordInput.classList.add('is-invalid');
        confirmPasswordInput.classList.add('is-invalid');
        return;
    }

    UI.LockUI(registerBtn);
    
    const msg = "register-information ->\n" + 
    "email: [" + emailInput.value + "]\n" + 
    "phone: [" + phoneInput.value + "]\n" + 
    "password: [" + passwordInput.value + "]\n" + 
    "confirm-password: [" + confirmPasswordInput.value + "]";
    console.log(msg);

    setTimeout(() => 
        {
            UI.UnlockUI();
        }
    , 2000);
}