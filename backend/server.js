const express = require('express');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

// Serve static files from the 'public' folder (located in backend/public)
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html at the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware to parse JSON bodies for REST API calls
app.use(express.json());

// Configure PostgreSQL client
const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'postgres'
});

// JWT secret (not currently used for PUT/DELETE endpoints)
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

// Authentication middleware (not applied to PUT/DELETE for now)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1]; // Expecting format "Bearer <token>"
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

// Initialize the database: create tables if they don't exist
async function initializeDatabase() {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS venues (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(255),
        district VARCHAR(255)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);
    console.log('Tables ensured.');
  } catch (err) {
    console.error('Error creating tables:', err.stack);
  }
}

// Seed venues from data/stores.json if table is empty
async function seedVenues() {
  try {
    const result = await client.query('SELECT COUNT(*) FROM venues;');
    const count = parseInt(result.rows[0].count, 10);
    if (count === 0) {
      const initialData = require('./data/stores.json');
      for (const venue of initialData) {
        await client.query(
          'INSERT INTO venues (name, url, district) VALUES ($1, $2, $3);',
          [venue.name, venue.url, venue.district]
        );
      }
      console.log('Seeded initial data into venues table.');
    } else {
      console.log('Venues table already contains data.');
    }
  } catch (err) {
    console.error('Error seeding venues:', err.stack);
  }
}

/* 
 * REST API Endpoints for Venues 
 */

// GET: Return the list of venues
app.get('/api/venues', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM venues;');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching venues:', err.stack);
    res.status(500).json({ error: 'Error fetching venues' });
  }
});

// POST: Add a new venue
app.post('/api/venues', async (req, res) => {
  try {
    const { name, url, district } = req.body;
    const result = await client.query(
      'INSERT INTO venues (name, url, district) VALUES ($1, $2, $3) RETURNING *;',
      [name, url, district]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding venue:', err.stack);
    res.status(500).json({ error: 'Error adding venue' });
  }
});

// PUT: Update an existing venue by id (login temporarily not required)
app.put('/api/venues/:id', async (req, res) => {
  try {
    console.log("Update request for ID:", req.params.id);
    console.log("Update data:", req.body);
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid venue ID format' });
    }
    const { name, url, district } = req.body;
    const result = await client.query(
      'UPDATE venues SET name = $1, url = $2, district = $3 WHERE id = $4 RETURNING *;',
      [name, url, district, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    console.log("Venue updated:", result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating venue:", err.stack);
    res.status(500).json({ error: "Error updating venue" });
  }
});

// DELETE: Remove a venue by id (login temporarily not required)
app.delete('/api/venues/:id', async (req, res) => {
  try {
    console.log("Delete request for ID:", req.params.id);
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid venue ID format' });
    }
    const result = await client.query(
      'DELETE FROM venues WHERE id = $1 RETURNING *;',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    console.log("Venue deleted:", result.rows[0]);
    res.json({ message: 'Venue deleted successfully' });
  } catch (err) {
    console.error("Error deleting venue:", err.stack);
    res.status(500).json({ error: "Error deleting venue" });
  }
});

/* 
 * REST API Endpoints for User Authentication (Optional, not used in venue routes yet)
 */

// Signup - Create a new account
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    const userCheck = await client.query('SELECT * FROM users WHERE username = $1;', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await client.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *;',
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Error signing up:', err.stack);
    res.status(500).json({ error: 'Error signing up' });
  }
});

// Login - Authenticate a user and return a JWT
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await client.query('SELECT * FROM users WHERE username = $1;', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error('Error logging in:', err.stack);
    res.status(500).json({ error: 'Error logging in' });
  }
});

// Start the server after connecting to PostgreSQL and ensuring tables exist
const startServer = async () => {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');
    await initializeDatabase();
    await seedVenues();
  } catch (err) {
    console.error('Database connection error:', err.stack);
  }
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
};

startServer();
