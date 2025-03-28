// auth.js - Backend version
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Secret key for JWT (preferably from environment variable)
const JWT_SECRET = process.env.JWT_SECRET || '2f9a5f1c03b4e7d6a9c8b7d6a9f2c3b6a9f2e5d8c7b6a9f3c6e9d2a5f8c7b4a1';

// User data file path
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create empty users file if it doesn't exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

// Load user data
function loadUsers() {
  try {
    const userData = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(userData);
  } catch (error) {
    console.error('Error loading users data:', error);
    return [];
  }
}

// Save users to file
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error saving users data:', error);
  }
}

// Signup endpoint
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Load existing users
    const users = loadUsers();
    
    // Check if user already exists
    if (users.some(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    
    if (users.some(u => u.username === username)) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user with enhanced profile fields
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      favorites: [],      // Store full movie objects
      watchlist: [],      // Store full movie objects
      letterboxd_username: '',
      recommendations_count: 0,
      last_recommendation_date: null,
      created_at: new Date().toISOString()
    };
    
    // Add to users and save
    users.push(newUser);
    saveUsers(users);
    
    // Create token
    const token = jwt.sign(
      { 
        id: newUser.id, 
        username: newUser.username 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Return success
    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        favorites: newUser.favorites,
        watchlist: newUser.watchlist,
        recommendations_count: 0
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Load users
    const users = loadUsers();
    
    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Create token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Return success
    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        favorites: user.favorites || [],
        watchlist: user.watchlist || [],
        recommendations_count: user.recommendations_count || 0,
        letterboxd_username: user.letterboxd_username || ''
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Profile endpoint with full user details
router.get('/profile', authenticateToken, (req, res) => {
  try {
    const users = loadUsers();
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      favorites: user.favorites || [],
      watchlist: user.watchlist || [],
      recommendations_count: user.recommendations_count || 0,
      letterboxd_username: user.letterboxd_username || '',
      created_at: user.created_at,
      last_recommendation_date: user.last_recommendation_date
    });
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to authenticate JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    // Different error messages for different token issues
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(403).json({ error: 'Invalid token. Authentication failed.' });
  }
}

module.exports = { router, authenticateToken };