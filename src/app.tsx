import express, { Application, Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { z } from 'zod';

const app: Application = express();
app.use(express.json());

// SQLite3 database setup
const dbPromise = open({
  filename: './database.db',
  driver: sqlite3.Database
});

// Add validation schema here 👇
const employeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  position: z.string().min(2, "Position cannot be empty")
});

// Initialize database
async function initializeDB() {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position TEXT NOT NULL
    )
  `);
}
initializeDB();

// Routes
// POST - Create employee
app.post('/employees', async (req: Request, res: Response) => {
  try {
    // Validate request body 👇
    const validatedData = employeeSchema.parse(req.body);
    
    const db = await dbPromise;    
    const result = await db.run(
      'INSERT INTO employees (name, position) VALUES (?, ?)',
      [validatedData.name, validatedData.position]
    );
    
    res.status(201).json({ 
      id: result.lastID,
      ...validatedData 
    });
    
  } catch (error) {
    // Add Zod error handling 👇
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: error.errors 
      });
    }
    const message = error instanceof Error ? error.message : 'Invalid request';
    res.status(400).json({ error: message });
  }
});

// GET - All employees
app.get('/employees', async (req: Request, res: Response) => {
  try {
    const db = await dbPromise;
    const employees = await db.all('SELECT * FROM employees');
    res.json(employees);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    res.status(500).json({ error: message });
  }
});

// GET - Single employee
app.get('/employees/:id', async (req: Request, res: Response) => {
  try {
    const db = await dbPromise;
    const employee = await db.get(
      'SELECT * FROM employees WHERE id = ?',
      [req.params.id]
    );
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json(employee);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    res.status(500).json({ error: message });
  }
});

// PUT - Update employee
app.put('/employees/:id', async (req: Request, res: Response) => {
  try {
    // Validate request body 👇
    const validatedData = employeeSchema.parse(req.body);
    
    const db = await dbPromise;
    const result = await db.run(
      'UPDATE employees SET name = ?, position = ? WHERE id = ?',
      [validatedData.name, validatedData.position, req.params.id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json({ 
      id: req.params.id, 
      ...validatedData 
    });
    
  } catch (error) {
    // Add Zod error handling 👇
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: error.errors 
      });
    }
    const message = error instanceof Error ? error.message : 'Invalid request';
    res.status(400).json({ error: message });
  }
});

// DELETE - Remove employee
app.delete('/employees/:id', async (req: Request, res: Response) => {
  try {
    const db = await dbPromise;
    const result = await db.run(
      'DELETE FROM employees WHERE id = ?',
      [req.params.id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    res.status(500).json({ error: message });
  }
});

// Start server
app.listen(3000, () => {
  console.log('🚀 Server running: http://localhost:3000');
});