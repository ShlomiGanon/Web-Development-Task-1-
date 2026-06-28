/* eslint-disable no-unused-vars */
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

app.listen(PORT, HOST, () => 
{
    connectDB();
    my_logger.ConsoleLog(`Server is running on port ${PORT} and host ${HOST}`, my_logger.Log_Level.INFO);
    my_logger.OperationLog('server', `Server is running on port ${PORT} and host ${HOST}`, {}, my_logger.Log_Level.INFO);
}).on('close', () => 
{
    disconnectDB();
    my_logger.ConsoleLog('Server is shutting down', my_logger.Log_Level.INFO);
    my_logger.OperationLog('server', 'Server is shutting down', {}, my_logger.Log_Level.INFO);
});

async function ConsoleSetPermission(user_id, permission_level)
{
    const user = await User.findById(user_id);
    if(!user)return false;
    if(permission_level == PM.PermissionLevel.USER)return PM.PermissionManagerInstance.removePermissionLevel(user_id);
    return PM.PermissionManagerInstance.setPermissionLevel(user_id, permission_level);
}

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

    if (cmd === 'setpermission')
    {
        if(params.length < 2)
        {
            console.log('[Console] Usage: setpermission <email> <permission_level>');
            return;
        }
        const email = params[0];
        const user = await User.findOne({ email });
        if(!user)
        {
            console.log(`[Console] User with email ${email} not found`);
            return;
        }
        const level = parseInt(params[1]);
        const success = await ConsoleSetPermission(user._id, level);
        
        if (success)
        {
            console.log(`[Console] Permission updated for user: ${user.email}`);
        }
        else
        {
            console.log(`[Console] Failed to update user: ${user.email}`);
        }
    }
});

module.exports = app;