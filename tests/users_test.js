const readline = require('readline').createInterface(
{
    input: process.stdin,
    output: process.stdout
}
);

const BASE_URL = 'http://localhost:3000/api/user';
let authToken = '';

async function loginAsAdmin()
{
    const response = await fetch(`${BASE_URL}/login`,
    {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_or_phone: 'test1@test.com', password: 'Password123!' })
    });
    
    const data = await response.json();
    if (!data.success) throw new Error(`Login failed: ${data.message}`);
    
    authToken = data.token;
    console.log("Logged in successfully!");
}

async function createFakeUsers()
{
    // send 'birthday' because that is the name the Controller extracts from req.body
    const users =
    [
        { email: 'test1@test.com', phone: '0501111111', password: 'Password123!', fullName: 'John Doe', birthday: '1990-01-01' },
        { email: 'test2@test.com', phone: '0502222222', password: 'Password123!', fullName: 'Jane Smith', birthday: '1995-05-05' }
    ];

    for (const user of users)
    {
        const res = await fetch(`${BASE_URL}/register`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });
        const result = await res.json();
        console.log(`User ${user.email} creation: ${result.message}`);
    }
}

async function searchLoop()
{
    console.log("\n--- Search Mode (type 'exit' to quit) ---");
    while (true)
    {
        const query = await new Promise(resolve => readline.question('\nEnter search filter: ', resolve));
        if (query.toLowerCase() === 'exit') process.exit();

        const response = await fetch(`${BASE_URL}/search?${query}`,
        {
            method: 'GET',
            headers:
            { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json' 
            }
        });
        
        const results = await response.json();
        console.log('Results:', JSON.stringify(results, null, 2));
    }
}

async function run()
{
    try 
    {
        
        // 1. ask the user if they want to add fake users
        const answer = await new Promise((resolve) => 
        {
            readline.question('Do you want to add fake users? (y/n): ', resolve);
        });

        // 2. if the user wants to add fake users, add them
        if (answer.toLowerCase() === 'y')
        {
            console.log("Adding fake users...");
            await createFakeUsers();
        }
        else
        {
            console.log("Skipping user creation.");
        }
        // 3. then we login as admin
        await loginAsAdmin();
        
        // 4. then we go to the search
        searchLoop();
        
    }
    catch (error)
    {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

run();