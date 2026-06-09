const constants = require('./constants');
function Is_Valid_Name(name)
{
    return /^[a-zA-Z]+$/.test(name);
}

function Is_Valid_Email(email)
{
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

function Is_Valid_Phone(phone)
{
    const phoneRegex = /^05[0-9]{8}$/;
    return phoneRegex.test(phone);
}

function Is_Valid_Password(password,minLength = constants.MIN_PASSWORD_LENGTH,maxLength = constants.MAX_PASSWORD_LENGTH)
{
    if(password.length < minLength || password.length > maxLength)return false;
    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-={};':"|,.<>/?]*$/;
    return passwordRegex.test(password);
}

module.exports = 
{
    Is_Valid_Name,
    Is_Valid_Email,
    Is_Valid_Phone,
    Is_Valid_Password
}