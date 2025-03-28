// user.js - Updated routes for favorites and watchlist
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
    console.log('Movie ID:', movieId);
    if (!movieId) {
      return res.status(400).json({ error: 'Movie details are required' });
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
    const existingMovieIndex = users[userIndex].favorites.findIndex(
      favMovie => favMovie.id === movie.id
    );

    if (existingMovieIndex !== -1) {
      return res.status(400).json({ error: 'Movie already in favorites' });
    }

    // Add movie to favorites
    users[userIndex].favorites.push(movie);
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

    // Remove movie from favorites
    const initialLength = users[userIndex].favorites.length;
    users[userIndex].favorites = users[userIndex].favorites.filter(
      movie => movie.id !== movieId
    );

    if (users[userIndex].favorites.length === initialLength) {
      return res.status(400).json({ error: 'Movie not in favorites' });
    }

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

// Similar modifications for watchlist routes...
router.post('/watchlist/add', authenticateToken, (req, res) => {
  try {
    const { movie } = req.body;
    if (!movie || !movie.id) {
      return res.status(400).json({ error: 'Movie details are required' });
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
    const existingMovieIndex = users[userIndex].watchlist.findIndex(
      watchMovie => watchMovie.id === movie.id
    );

    if (existingMovieIndex !== -1) {
      return res.status(400).json({ error: 'Movie already in watchlist' });
    }

    // Add movie to watchlist
    users[userIndex].watchlist.push(movie);
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

    // Remove movie from watchlist
    const initialLength = users[userIndex].watchlist.length;
    users[userIndex].watchlist = users[userIndex].watchlist.filter(
      movie => movie.id !== movieId
    );

    if (users[userIndex].watchlist.length === initialLength) {
      return res.status(400).json({ error: 'Movie not in watchlist' });
    }

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

module.exports = router;