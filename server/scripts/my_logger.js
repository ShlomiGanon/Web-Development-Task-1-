//define enum for the levels.
const fs = require('fs');

//create the log directory if it doesn't exist
const logDirectory = 'logs';
const operationDirectoryName = `operation_logs`;
if (!fs.existsSync(logDirectory)) 
{
    fs.mkdirSync(logDirectory);
}
if (!fs.existsSync(`${logDirectory}/${operationDirectoryName}`)) 
{
    fs.mkdirSync(`${logDirectory}/${operationDirectoryName}`);
}

exports.Log_Level = 
{
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
    DEBUG: 'debug'
}

function ConsoleLog(message, level = exports.Log_Level.INFO)
{
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}
//operation: string -> the operation name
//message: string -> the message of the operation
//data: object -> the data of the operation
function OperationLog(operation , message , data, level = exports.Log_Level.INFO)
{
    //write the data to the operation log file
    const timestamp = new Date().toISOString();
    const logEntry = `[${level}] [${timestamp}] ${message} ${JSON.stringify(data)}`;
    const logFile = `${logDirectory}/${operationDirectoryName}/${operation}.log`;
    fs.appendFileSync(logFile, logEntry + '\n');
}

module.exports = { ConsoleLog, OperationLog };