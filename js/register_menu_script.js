import * as UI from './ui-utils.js';
import * as Auth from './auth.js';
import * as Constants from './constances.js';
import { ClientSessionManager } from './clientSessionManager.js';


const firstNameInput = document.getElementById('first-name-field');
const lastNameInput = document.getElementById('last-name-field');
const emailInput = document.getElementById('mail-field');
const phoneInput = document.getElementById('phone-field');
const passwordInput = document.getElementById('password-field');
const confirmPasswordInput = document.getElementById('confirm-password-field');
const registerBtn = document.getElementById('register-button');

registerBtn.addEventListener('click', Register_Click);

async function Register_Click() 
{
    const is_not_empty = (text) => text !== "";

    const rules = 
    [
        new Auth.InputRule(firstNameInput, "שם פרטי הוא שדה חובה", is_not_empty),
        new Auth.InputRule(firstNameInput, "שם פרטי אינו תקין", Auth.is_valid_name),
        new Auth.InputRule(lastNameInput, "שם משפחה הוא שדה חובה", is_not_empty),
        new Auth.InputRule(lastNameInput, "שם משפחה אינו תקין", Auth.is_valid_name),
        new Auth.InputRule(emailInput, "אימייל הוא שדה חובה", is_not_empty),
        new Auth.InputRule(emailInput, "האימייל אינו תקין", Auth.Is_Valid_Email),
        new Auth.InputRule(phoneInput, "מספר נייד הוא שדה חובה", is_not_empty),
        new Auth.InputRule(phoneInput, "המספר נייד אינו תקין", Auth.Is_Valid_Phone),
        new Auth.InputRule(passwordInput, "סיסמה היא שדה חובה", is_not_empty),
        new Auth.InputRule(passwordInput, `אורך סיסמה לא תקין [${Constants.MIN_PASSWORD_LENGTH}-${Constants.MAX_PASSWORD_LENGTH}]`, Auth.Is_Valid_Password, [Constants.MIN_PASSWORD_LENGTH, Constants.MAX_PASSWORD_LENGTH]),
        new Auth.InputRule(confirmPasswordInput, "אימות סיסמה הוא שדה חובה", is_not_empty),
        new Auth.InputRule(confirmPasswordInput, "אימות הסיסמה אינו זהה לסיסמה", (text) => text === passwordInput.value)
    ];

    if (!Auth.ValidateForm(rules)) 
    {
        return;
    }
    
    UI.LockUI(registerBtn);
    UI.ShowMessage("מבצע רישום...");

    try 
    {
        const fullNameValue = `${firstNameInput.value.trim()} ${lastNameInput.value.trim()}`;

        const response = await ClientSessionManager.register(
            emailInput.value.trim(),
            phoneInput.value.trim(),
            passwordInput.value,
            fullNameValue
        );

        if (response && response.success)
        {
            UI.ShowMessage("הרשמה בוצעה בהצלחה , אתה מועבר לדף התחברות");
            
            setTimeout(() => 
            {
                UI.GoToLink('../html/login_menu.html');
            }, 2000);
        }
        else
        {
            const errorMsg = response ? response.message : "שגיאה בתהליך הרישום, נסה שנית";
            UI.ShowErrorMessage(errorMsg);
            UI.UnlockUI();
        }
    }
    catch (error) 
    {
        console.error("Registration crashed:", error);
        UI.ShowErrorMessage("תקלת תקשורת מול השרת. אנא נסה שוב.");
        UI.UnlockUI();
    }
}