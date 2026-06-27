const constants = require('./constants.js');
const bcrypt = require('bcrypt');



//check if the name is valid
function Is_Valid_Name(name)
{
    return /^[a-zA-Z]+$/.test(name);
}

//check if the email is valid
function Is_Valid_Email(email)
{
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

//check if the phone is valid
function Is_Valid_Phone(phone)
{
    const phoneRegex = /^05[0-9]{8}$/;
    return phoneRegex.test(phone);
}

//check if the password is valid
function Is_Valid_Password(password,minLength = constants.MIN_PASSWORD_LENGTH,maxLength = constants.MAX_PASSWORD_LENGTH)
{
    if(password.length < minLength || password.length > maxLength)return false;
    const passwordRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-={};':"|,.<>/?]*$/;
    return passwordRegex.test(password);
}

//get the age from the birthday
function get_age_from_birthday(birthday)
{
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if(m < 0 || (m === 0 && today.getDate() < birthDate.getDate()))age--;
    return age;
}

//hash the password
function Hash_Password(password)
{
    return bcrypt.hash(password, 10);
}

//compare the password with the hashed password
function Compare_Password(password, hashedPassword)
{
    return bcrypt.compare(password, hashedPassword);
}

module.exports = 
{
    Is_Valid_Name,
    Is_Valid_Email,
    Is_Valid_Phone,
    Is_Valid_Password,
    get_age_from_birthday,
    Hash_Password,
    Compare_Password
}