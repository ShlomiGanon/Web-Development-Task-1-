const mongoose = require('mongoose');

async function connectDB()
{
    try 
    {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/netflix');
        console.log('Connected to MongoDB');
        return true;
    }
    catch (error) 
    {
        console.error('Error connecting to MongoDB:', error);
        return false;
    }
}

async function disconnectDB() 
{
    try 
    {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        return true;
    } 
    catch (error) 
    {
        console.error('Error disconnecting from MongoDB:', error);
        return false;
    }
}

module.exports = { connectDB, disconnectDB };