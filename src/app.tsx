import express, { Application, Request, Response } from 'express';

const app: Application = express();
app.use(express.json());

interface Employee {
  id: number;
  name: string;
  position: string;
}

let employees: Employee[] = [
  { id: 1, name: "Ali", position: "Manager" }
];

// POST route to add employee
app.post('/employees', (req: Request, res: Response) => {
  const newEmployee: Employee = {
    id: employees.length + 1,
    name: req.body.name,
    position: req.body.position
  };
  employees.push(newEmployee);
  res.send('Employee added!');
});

// GET route to fetch one employee
app.get('/employees/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const employee = employees.find(emp => emp.id === id);

  if (!employee) {
    return res.status(404).send("Employee not found");
  }

  res.send(employee);
});

// PUT route to update employee
app.put('/employees/:id', (req: Request<{ id: string }, {}, Partial<Employee>>, res: Response) => {
  const id = parseInt(req.params.id);
  const employeeIndex = employees.findIndex(emp => emp.id === id);

  if (employeeIndex === -1) {
    return res.status(404).send("Employee not found");
  }

  // Merge existing data with updates
  employees[employeeIndex] = { 
    ...employees[employeeIndex], 
    ...req.body 
  };

  res.send(employees[employeeIndex]);
});

// DELETE route to remove employee
app.delete('/employees/:id', (req: Request<{ id: string }>, res: Response) => {
  const id = parseInt(req.params.id);
  const initialLength = employees.length;
  
  employees = employees.filter(emp => emp.id !== id);
  
  if (employees.length === initialLength) {
    return res.status(404).send("Employee not found");
  }
  
  res.send("Employee deleted successfully");
});

app.listen(3000, () => {
  console.log('Server running: http://localhost:3000');
});