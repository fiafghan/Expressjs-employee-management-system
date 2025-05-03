import express, { Request, Response } from 'express';
const app = express();

// Middleware to read JSON data (MUST ADD THIS!)
app.use(express.json());

// Fake database (temporary array)
interface Employee {
  id: number;
  name: string;
  position: string;
}

let employees: Employee[] = [
  { id: 1, name: "Ali", position: "Manager" }
];

// Add new employee (POST)
app.post('/employees', (req: Request, res: Response) => {
  // Get data from user's request body (JSON)
  const newEmployee: Employee = {
    id: employees.length + 1,
    name: req.body.name,
    position: req.body.position
  };
  employees.push(newEmployee); // Add to array
  res.send('Employee added! 🧑💼');
});

// Start server
app.listen(3000, () => {
  console.log('Server running: http://localhost:3000');
});