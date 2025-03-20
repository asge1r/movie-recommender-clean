// user.js - User routes for favorites and watchlist
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

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

// Set Letterboxd username
router.post('/letterboxd', authenticateToken, (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Letterboxd username is required' });
    }

    const users = loadUsers();
    const userIndex = users.findIndex(user => user.id === req.user.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update letterboxd username
    users[userIndex].letterboxd_username = username;
    saveUsers(users);

    res.json({ 
      message: 'Letterboxd username updated',
      letterboxd_username: username 
    });
  } catch (error) {
    console.error('Update Letterboxd username error:', error);
    res.status(500).json({ error: 'Server error updating Letterboxd username' });
  }
});

// Get Letterboxd rated movies
router.get('/letterboxd/rated', authenticateToken, async (req, res) => {
  try {
    const users = loadUsers();
    const user = users.find(user => user.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.letterboxd_username) {
      return res.status(400).json({ error: 'Letterboxd username not set' });
    }
    
    try {
      // This would be a real API call in a production environment
      // For now, we'll use a mock response as Letterboxd API requires approval
      const ratedMovies = await mockLetterboxdRatedMovies(user.letterboxd_username);
      
      res.json({ rated_movies: ratedMovies });
    } catch (apiError) {
      console.error('Letterboxd API error:', apiError);
      res.status(503).json({ error: 'Error fetching data from Letterboxd' });
    }
  } catch (error) {
    console.error('Get Letterboxd ratings error:', error);
    res.status(500).json({ error: 'Server error getting Letterboxd ratings' });
  }
});

// Mock function to simulate Letterboxd API for rated movies
// In a real implementation, this would be replaced with actual API calls
async function mockLetterboxdRatedMovies(username) {
  // Simulated delay to mimic API call
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Sample list of popular movies with ratings
  const sampleRatedMovies = [
    { title: "The Shawshank Redemption", year: 1994, rating: 5.0, watched_date: "2024-01-15" },
    { title: "The Godfather", year: 1972, rating: 5.0, watched_date: "2024-02-03" },
    { title: "Pulp Fiction", year: 1994, rating: 4.5, watched_date: "2024-02-20" },
    { title: "The Dark Knight", year: 2008, rating: 4.5, watched_date: "2024-03-05" },
    { title: "Fight Club", year: 1999, rating: 4.0, watched_date: "2024-01-22" },
    { title: "Inception", year: 2010, rating: 4.0, watched_date: "2024-02-11" },
    { title: "The Matrix", year: 1999, rating: 4.5, watched_date: "2024-03-02" },
    { title: "Goodfellas", year: 1990, rating: 4.0, watched_date: "2024-01-28" },
    { title: "The Lord of the Rings: The Fellowship of the Ring", year: 2001, rating: 5.0, watched_date: "2024-02-16" },
    { title: "Forrest Gump", year: 1994, rating: 4.0, watched_date: "2024-03-10" }
  ];
  
  // Use username to deterministically select a subset of movies
  const hash = crypto.createHash('md5').update(username).digest('hex');
  const hashNum = parseInt(hash.substring(0, 8), 16);
  const numMovies = 5 + (hashNum % 6); // Return between 5-10 movies based on username
  
  // Shuffle array based on username
  const shuffled = [...sampleRatedMovies];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor((hashNum / (i + 1)) % (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, numMovies);
}

module.exports = router;