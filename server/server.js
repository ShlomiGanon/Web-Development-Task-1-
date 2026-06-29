/* eslint-disable no-unused-vars */
require("dotenv").config();// load the environment variables from the .env file
const express = require('express');
const User = require('./models/user.js');
const PM = require('./middlewares/permission_manager.js');
const { connectDB, disconnectDB } = require('./config/db.js');
const my_logger = require('./scripts/my_logger.js');
const path = require('path');
const routes = require('./routes/routes.js');
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', routes);

const server = app.listen(PORT, HOST, async () => 
{
    await connectDB();
    my_logger.ConsoleLog(`Server is running on port ${PORT} and host ${HOST}`, my_logger.Log_Level.INFO);
    my_logger.OperationLog('server', `Server is running on port ${PORT} and host ${HOST}`, {}, my_logger.Log_Level.INFO);
}).on('close', async () => 
{
    await disconnectDB();
    my_logger.ConsoleLog('Server is shutting down', my_logger.Log_Level.INFO);
    my_logger.OperationLog('server', 'Server is shutting down', {}, my_logger.Log_Level.INFO);
});

async function ConsoleSetPermission(user_id, permission_level)
{
    const user = await User.findById(user_id);
    if(!user)return false;
    if(permission_level === PM.Permmision_Level.USER)return PM.permissionManagerInstance.removePermissionLevel(user_id);
    return PM.permissionManagerInstance.setPermissionLevel(user_id, permission_level);
}

// Shutdown the server and the readline interface after 3 seconds if the server is not closed
function shutdown()
{
    server.close();
    rl.close();
    setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

//-------------------- CMDS ----------------
const readline = require('readline');

// Create a console interface
const rl = readline.createInterface(
    {
        input: process.stdin,
        output: process.stdout,
        terminal: true 
    }
);

// Listen to lines typed in the terminal
rl.on('line', async (line) => 
{
    const [cmd , ...params] = line.split(' ');
    switch(cmd.toLowerCase())
    {
        case 'closeserver':
        {
            shutdown();
            break;
        }
        case 'setpermission':
        {

            if(params.length < 2)
            {
                console.log('Usage: SetPermission <email> <permission_level>');
                return;
            } 
            const email = params[0];
            const level = parseInt(params[1]);
            const user = await User.findOne({ email });
            if(!user)
            {
                console.log(`SetPermission: User with email ${email} not found`);
                return;
            }
            const success = await ConsoleSetPermission(String(user._id), level);
            if (success)console.log(`SetPermission: Permission updated for user: ${user.email} to level ${level}`);
            else console.log(`SetPermission: Failed to update user: ${user.email}`);
            break;
        }
        default:
        {
            console.log(`Command not found: ${cmd}`);
            return;
        }
    }
});



module.exports = app;