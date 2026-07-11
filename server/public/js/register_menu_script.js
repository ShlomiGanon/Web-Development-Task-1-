import * as UI from './ui-utils.js';
import * as Auth from './auth.js';
import * as Constants from './constances.js';
import { Backend } from './config.js';

const FullNameInput = document.getElementById('full-name-field');
const birthdayInput = document.getElementById('birthday-field');
const emailInput = document.getElementById('mail-field');
const phoneInput = document.getElementById('phone-field');
const passwordInput = document.getElementById('password-field');
const confirmPasswordInput = document.getElementById('confirm-password-field');
const registerButton = document.getElementById('register-button');
registerButton.addEventListener('click', Register_Click);

async function Register_Click()
{
    const isNotEmpty = (text) => text !== "";
    const IsValidFullName = (text) => Auth.is_valid_name(text.split(' ')[0]) && Auth.is_valid_name(text.split(' ')[1]);
    const rules =
    [
        new Auth.InputRule(FullNameInput, "שם מלא הוא שדה חובה", isNotEmpty),
        new Auth.InputRule(FullNameInput, "שם פרטי או שם משפחה אינו תקין", IsValidFullName),
        new Auth.InputRule(birthdayInput, "תאריך לידה הוא שדה חובה", isNotEmpty),
        new Auth.InputRule(birthdayInput, "תאריך לידה אינו תקין", Auth.is_valid_birthday),
        new Auth.InputRule(emailInput, "אימייל הוא שדה חובה", isNotEmpty),
        new Auth.InputRule(emailInput, "האימייל אינו תקין", Auth.Is_Valid_Email),
        new Auth.InputRule(phoneInput, "מספר נייד הוא שדה חובה", isNotEmpty),
        new Auth.InputRule(phoneInput, "המספר נייד אינו תקין", Auth.Is_Valid_Phone),
        new Auth.InputRule(passwordInput, "סיסמה היא שדה חובה", isNotEmpty),
        new Auth.InputRule(passwordInput, `אורך סיסמה לא תקין [${Constants.MIN_PASSWORD_LENGTH}-${Constants.MAX_PASSWORD_LENGTH}]`, Auth.Is_Valid_Password, [Constants.MIN_PASSWORD_LENGTH, Constants.MAX_PASSWORD_LENGTH]),
        new Auth.InputRule(confirmPasswordInput, "אימות סיסמה הוא שדה חובה", isNotEmpty),
        new Auth.InputRule(confirmPasswordInput, "אימות הסיסמה אינו זהה לסיסמה", (text) => text === passwordInput.value),

    ];

    if (!Auth.ValidateForm(rules))
    {
        return;
    }

    UI.LockUI(registerButton);
    UI.ShowMessage("מבצע רישום...");

    try
    {
        // Backend only stores a single fullName field and splits it on the first space
        // (word 1 = firstName, word 2 = lastName), so first/last must be joined this way.
        const fullNameValue = FullNameInput.value.trim();

        const response = await Backend.register(
            emailInput.value.trim(),
            phoneInput.value.trim(),
            passwordInput.value,
            fullNameValue,
            birthdayInput.value.trim()
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