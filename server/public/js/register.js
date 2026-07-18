// Register page: validates the sign-up form and creates a new account.

import { lockUi, unlockUi, showMessage, showErrorMessage, goToLink } from './ui.js';
import { InputRule, validateForm, isValidName, isValidEmail, isValidPhone, isValidPassword, isValidBirthday } from './validation.js';
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, Backend } from './constants.js';

const fullNameInput = document.getElementById('full-name-field');
const birthdayInput = document.getElementById('birthday-field');
const emailInput = document.getElementById('mail-field');
const phoneInput = document.getElementById('phone-field');
const passwordInput = document.getElementById('password-field');
const confirmPasswordInput = document.getElementById('confirm-password-field');
const registerButton = document.getElementById('register-button');
registerButton.addEventListener('click', handleRegisterClick);

async function handleRegisterClick()
{
    const isNotEmpty = (text) => text !== "";
    const isValidFullName = (text) => isValidName(text.split(' ')[0]) && isValidName(text.split(' ')[1]);
    const rules =
    [
        new InputRule(fullNameInput, "שם מלא הוא שדה חובה", isNotEmpty),
        new InputRule(fullNameInput, "שם פרטי או שם משפחה אינו תקין", isValidFullName),
        new InputRule(birthdayInput, "תאריך לידה הוא שדה חובה", isNotEmpty),
        new InputRule(birthdayInput, "תאריך לידה אינו תקין", isValidBirthday),
        new InputRule(emailInput, "אימייל הוא שדה חובה", isNotEmpty),
        new InputRule(emailInput, "האימייל אינו תקין", isValidEmail),
        new InputRule(phoneInput, "מספר נייד הוא שדה חובה", isNotEmpty),
        new InputRule(phoneInput, "המספר נייד אינו תקין", isValidPhone),
        new InputRule(passwordInput, "סיסמה היא שדה חובה", isNotEmpty),
        new InputRule(passwordInput, `אורך סיסמה לא תקין [${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH}]`, isValidPassword, [MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH]),
        new InputRule(confirmPasswordInput, "אימות סיסמה הוא שדה חובה", isNotEmpty),
        new InputRule(confirmPasswordInput, "אימות הסיסמה אינו זהה לסיסמה", (text) => text === passwordInput.value),
    ];

    if (!validateForm(rules))
    {
        return;
    }

    lockUi(registerButton);
    showMessage("מבצע רישום...");

    try
    {
        // Backend only stores a single fullName field and splits it on the first space
        // (word 1 = firstName, word 2 = lastName), so first/last must be joined this way.
        const fullNameValue = fullNameInput.value.trim();

        const response = await Backend.register(
            emailInput.value.trim(),
            phoneInput.value.trim(),
            passwordInput.value,
            fullNameValue,
            birthdayInput.value.trim()
        );

        if (response && response.success)
        {
            showMessage("הרשמה בוצעה בהצלחה , אתה מועבר לדף התחברות");
            goToLink('../html/login.html');
        }
        else
        {
            const errorMessage = response ? response.message : "שגיאה בתהליך הרישום, נסה שנית";
            showErrorMessage(errorMessage);
            unlockUi();
        }
    }
    catch (error)
    {
        console.error("Registration crashed:", error);
        showErrorMessage("תקלת תקשורת מול השרת. אנא נסה שוב.");
        unlockUi();
    }
}
