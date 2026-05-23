import * as UI from './ui-utils.js';
import * as Auth from './auth.js';
const firstNameInput = document.getElementById('first-name-field');
const lastNameInput = document.getElementById('last-name-field');
const emailInput = document.getElementById('mail-field');
const phoneInput = document.getElementById('phone-field');
const passwordInput = document.getElementById('password-field');
const confirmPasswordInput = document.getElementById('confirm-password-field');
const registerBtn = document.getElementById('register-button');

registerBtn.addEventListener('click', Register_Click);//register button event listener


function Register_Click() //register button function
{
    const is_not_empty = (text) => text !== "";


    const rules = 
    [
        //first name rules
        new Auth.InputRule(firstNameInput, "שם פרטי הוא שדה חובה", is_not_empty),
        new Auth.InputRule(firstNameInput, "שם פרטי אינו תקין", Auth.is_valid_name),
        //last name rules
        new Auth.InputRule(lastNameInput, "שם משפחה הוא שדה חובה", is_not_empty),
        new Auth.InputRule(lastNameInput, "שם משפחה אינו תקין", Auth.is_valid_name),
        //email rules
        new Auth.InputRule(emailInput, "אימייל הוא שדה חובה", is_not_empty),
        new Auth.InputRule(emailInput, "האימייל אינו תקין", Auth.Is_Valid_Email),
        //phone rules
        new Auth.InputRule(phoneInput, "מספר נייד הוא שדה חובה", is_not_empty),
        new Auth.InputRule(phoneInput, "המספר נייד אינו תקין", Auth.Is_Valid_Phone),
        //password rules
        new Auth.InputRule(passwordInput, "סיסמה היא שדה חובה", is_not_empty),
        new Auth.InputRule(passwordInput, `אורך סיסמה לא תקין [${Auth.MIN_PASSWORD_LENGTH}-${Auth.MAX_PASSWORD_LENGTH}]`, Auth.Is_Valid_Password, [Auth.MIN_PASSWORD_LENGTH, Auth.MAX_PASSWORD_LENGTH]),
        //confirm password rules
        new Auth.InputRule(confirmPasswordInput, "אימות סיסמה הוא שדה חובה", is_not_empty),
        new Auth.InputRule(confirmPasswordInput, "אימות הסיסמה אינו זהה לסיסמה", (text) => text === passwordInput.value)
    ];

    
    if (!Auth.ValidateForm(rules)) return;//if the form is invalid we stop the function
    UI.LockUI(registerBtn);

    UI.ShowMessage("מבצע רישום...");
    if(response.success)
    {
        UI.ShowMessage("הרשמה בוצעה בהצלחה , אתה מועבר לדף התחברות");
        setTimeout(UI.GoToLink, 2000, '../html/login_menu.html');//wait for 2 seconds and then go to the login page
        // UI remains locked during navigation to prevent duplicate submissions.
        // Page memory will be cleared automatically by the browser upon redirection.
    }
    else
    {
        UI.ShowErrorMessage(response.message);
        UI.UnlockUI();//unlock the ui only if the login failed
    }
    
}