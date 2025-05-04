import express, { Application, Request, Response } from 'express';
import mysql from 'mysql2/promise';
import { Connection } from 'mysql2/promise';
import { z } from 'zod';

const app: Application = express();
app.use(express.json());

// MySQL connection pool:
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL || 'mysql://employee_user:password123@localhost:3306/employee_db',
  connectionLimit: 10
});

// Add validation schema here 👇
const employeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  position: z.string().min(2, "Position cannot be empty")
});

// Initialize database
async function initializeDB() {
  const conn = await pool.getConnection();
  await conn.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      position VARCHAR(255) NOT NULL
    )
  `);
  conn.release();
}

initializeDB();

// Routes
// POST - Create employee
app.post('/employees', async (req: Request, res: Response) => {
  try {
    const validatedData = employeeSchema.parse(req.body);
    const [result] = await pool.query(
      'INSERT INTO employees (name, position) VALUES (?, ?)',
      [validatedData.name, validatedData.position]
    );
    
    res.status(201).json({
      id: (result as any).insertId,
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
    const [rows] = await pool.query('SELECT * FROM employees');
    res.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    res.status(500).json({ error: message });
  }
});

// GET - Single employee
app.get('/employees/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM employees WHERE id = ?',
      [req.params.id]
    );
    
    if ((rows as any).length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json((rows as any)[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    res.status(500).json({ error: message });
  }
});

// PUT - Update employee
app.put('/employees/:id', async (req: Request, res: Response) => {
  try {
    const validatedData = employeeSchema.parse(req.body);
    const [result] = await pool.query(
      'UPDATE employees SET name = ?, position = ? WHERE id = ?',
      [validatedData.name, validatedData.position, req.params.id]
    );
    
    if ((result as any).affectedRows === 0) {
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
    const [result] = await pool.query(
      'DELETE FROM employees WHERE id = ?',
      [req.params.id]
    );
    
    if ((result as any).affectedRows === 0) {
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