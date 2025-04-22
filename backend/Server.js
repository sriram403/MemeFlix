// 1. Import the express library
const express = require('express');
const cors = require('cors'); // Import the cors library

// 2. Create an instance of the express application
const app = express();

// 3. Define the port the server will listen on
const PORT = 3001; // We choose 3001 to avoid potential conflicts with frontend (often 3000)

// 4. Apply Middleware
app.use(cors()); // Use the cors middleware for all incoming requests

// 4. Define a simple route for the root URL ('/')
//    This is like a basic health check or landing page for the API
app.get('/', (req, res) => {
  // req: object containing information about the incoming request
  // res: object used to send back the response
  res.send('Hello World from Memeflix Backend, Fucker!');
});

// 5. Start the server and make it listen for connections on the specified port
app.listen(PORT, () => {
  // This callback function is executed once the server successfully starts
  console.log(`Memeflix backend server is running on http://localhost:${PORT}`);
});