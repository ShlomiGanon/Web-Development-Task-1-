/* eslint-disable no-unused-vars */
const express = require('express');
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
    my_logger.ConsoleLog(`Server is running on port ${PORT} and host ${HOST}`, my_logger.Log_Level.INFO);
    my_logger.OperationLog('server', `Server is running on port ${PORT} and host ${HOST}`, {}, my_logger.Log_Level.INFO);
});
module.exports = app;