import 'dotenv/config';
import express, { Application, Request, Response } from 'express';
import mysql from 'mysql2/promise';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import type { RowDataPacket } from 'mysql2';


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

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
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

  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    )
  `);
  conn.release();
}
initializeDB();


const authenticate = (req: Request, res: Response, next: Function) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

// Rate limiting - 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Logging middleware
app.use(morgan('combined'));

// Allow requests from your React app's origin
app.use(cors({
  origin: 'http://localhost:5173', // React app's URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

// Routes
// Login route
app.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(1, "Password cannot be empty")
    }).parse(req.body);

    // ✅ Correct database query
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE email = ?', 
      [email]
    );
    
    // ✅ Proper user access
    const user = rows[0];
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET!, 
      { expiresIn: '1h' }
    );
    
    res.json({ token });
  }  catch (error) {
    // Replace the existing catch block with this
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors
      });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: "Login failed" });
  }
});


// Registration route
app.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = userSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check for existing user first
    const [existing] = await pool.query(
      'SELECT * FROM users WHERE email = ?', 
      [email]
    );
    
    if ((existing as any[]).length > 0) {
      return res.status(409).json({ error: "Email already exists" });
    }

    await pool.query(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [email, hashedPassword]
    );
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: "Registration failed" });
  }
});


// POST - Create employee
app.post('/employees', authenticate, async (req: Request, res: Response) => {
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
app.put('/employees/:id', authenticate, async (req: Request, res: Response) => {
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
app.delete('/employees/:id', authenticate, async (req: Request, res: Response) => {
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