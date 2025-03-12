// user.js - User routes for favorites and watchlist
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Get auth module
const auth = require('./auth');
const authenticateToken = auth.authenticateToken;

// User data file path
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Load user data
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const userData = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(userData);
    }
    return [];
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

// Add movie to favorites
router.post('/favorites/add', authenticateToken, (req, res) => {
  try {
    const { movieId } = req.body;
    if (!movieId) {
      return res.status(400).json({ error: 'Movie ID is required' });
    }

    const users = loadUsers();
    const userIndex = users.findIndex(user => user.id === req.user.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Initialize favorites array if it doesn't exist
    if (!users[userIndex].favorites) {
      users[userIndex].favorites = [];
    }

    // Check if movie is already in favorites
    if (users[userIndex].favorites.includes(movieId)) {
      return res.status(400).json({ error: 'Movie already in favorites' });
    }

    // Add movie to favorites
    users[userIndex].favorites.push(movieId);
    saveUsers(users);

    res.json({ 
      message: 'Movie added to favorites',
      favorites: users[userIndex].favorites 
    });
  } catch (error) {
    console.error('Add to favorites error:', error);
    res.status(500).json({ error: 'Server error adding to favorites' });
  }
});

// Remove movie from favorites
router.post('/favorites/remove', authenticateToken, (req, res) => {
  try {
    const { movieId } = req.body;
    if (!movieId) {
      return res.status(400).json({ error: 'Movie ID is required' });
    }

    const users = loadUsers();
    const userIndex = users.findIndex(user => user.id === req.user.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if favorites array exists
    if (!users[userIndex].favorites) {
      return res.status(400).json({ error: 'No favorites list found' });
    }

    // Check if movie is in favorites
    const movieIndex = users[userIndex].favorites.indexOf(movieId);
    if (movieIndex === -1) {
      return res.status(400).json({ error: 'Movie not in favorites' });
    }

    // Remove movie from favorites
    users[userIndex].favorites.splice(movieIndex, 1);
    saveUsers(users);

    res.json({ 
      message: 'Movie removed from favorites',
      favorites: users[userIndex].favorites 
    });
  } catch (error) {
    console.error('Remove from favorites error:', error);
    res.status(500).json({ error: 'Server error removing from favorites' });
  }
});

// Get favorites
router.get('/favorites', authenticateToken, (req, res) => {
  try {
    const users = loadUsers();
    const user = users.find(user => user.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ favorites: user.favorites || [] });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Server error getting favorites' });
  }
});

// Add movie to watchlist
router.post('/watchlist/add', authenticateToken, (req, res) => {
  try {
    const { movieId } = req.body;
    if (!movieId) {
      return res.status(400).json({ error: 'Movie ID is required' });
    }

    const users = loadUsers();
    const userIndex = users.findIndex(user => user.id === req.user.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Initialize watchlist array if it doesn't exist
    if (!users[userIndex].watchlist) {
      users[userIndex].watchlist = [];
    }

    // Check if movie is already in watchlist
    if (users[userIndex].watchlist.includes(movieId)) {
      return res.status(400).json({ error: 'Movie already in watchlist' });
    }

    // Add movie to watchlist
    users[userIndex].watchlist.push(movieId);
    saveUsers(users);

    res.json({ 
      message: 'Movie added to watchlist',
      watchlist: users[userIndex].watchlist 
    });
  } catch (error) {
    console.error('Add to watchlist error:', error);
    res.status(500).json({ error: 'Server error adding to watchlist' });
  }
});

// Remove movie from watchlist
router.post('/watchlist/remove', authenticateToken, (req, res) => {
  try {
    const { movieId } = req.body;
    if (!movieId) {
      return res.status(400).json({ error: 'Movie ID is required' });
    }

    const users = loadUsers();
    const userIndex = users.findIndex(user => user.id === req.user.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if watchlist array exists
    if (!users[userIndex].watchlist) {
      return res.status(400).json({ error: 'No watchlist found' });
    }

    // Check if movie is in watchlist
    const movieIndex = users[userIndex].watchlist.indexOf(movieId);
    if (movieIndex === -1) {
      return res.status(400).json({ error: 'Movie not in watchlist' });
    }

    // Remove movie from watchlist
    users[userIndex].watchlist.splice(movieIndex, 1);
    saveUsers(users);

    res.json({ 
      message: 'Movie removed from watchlist',
      watchlist: users[userIndex].watchlist 
    });
  } catch (error) {
    console.error('Remove from watchlist error:', error);
    res.status(500).json({ error: 'Server error removing from watchlist' });
  }
});

// Get watchlist
router.get('/watchlist', authenticateToken, (req, res) => {
  try {
    const users = loadUsers();
    const user = users.find(user => user.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ watchlist: user.watchlist || [] });
  } catch (error) {
    console.error('Get watchlist error:', error);
    res.status(500).json({ error: 'Server error getting watchlist' });
  }
});

module.exports = router;