// auth-frontend.js
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication status on page load
    checkAuthStatus();
  });
  
  // Helper function to get the authentication token
  function getAuthToken() {
    return localStorage.getItem('token');
  }
  
  // Helper function to make authenticated requests
  function makeAuthenticatedRequest(url, options = {}) {
    const token = getAuthToken();
    
    if (!token) {
      // Redirect to login if no token
      window.location.href = '/login';
      return Promise.reject('No authentication token');
    }
  
    // Merge default options with provided options
    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  
    const mergedOptions = {
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };
  
    return fetch(url, mergedOptions)
      .then(response => {
        if (response.status === 401 || response.status === 403) {
          // Token is invalid or expired
          logout();
          throw new Error('Authentication failed');
        }
        return response;
      });
  }
  
  // Check authentication status
  function checkAuthStatus() {
    const token = getAuthToken();
    const authButtons = document.getElementById('auth-buttons');
    
    if (token) {
      // User is logged in
      makeAuthenticatedRequest('/api/auth/profile')
        .then(response => response.json())
        .then(user => {
          // Update UI for logged-in user
          if (authButtons) {
            authButtons.innerHTML = `
              <span class="navbar-text me-2">Welcome, ${user.username}</span>
              <button class="btn btn-outline-light" id="logoutBtn">Logout</button>
            `;
            
            // Add logout event listener
            document.getElementById('logoutBtn').addEventListener('click', logout);
          }
          
          // Populate favorites or watchlist if on those pages
          if (window.location.pathname === '/favorites') {
            populateFavorites(user.favorites);
          } else if (window.location.pathname === '/watchlist') {
            populateWatchlist(user.watchlist);
          }
        })
        .catch(error => {
          console.error('Authentication check failed:', error);
          logout();
        });
    } else {
      // User is not logged in
      if (authButtons) {
        authButtons.innerHTML = `
          <a href="/login" class="btn btn-outline-light me-2">
            <i class="fas fa-sign-in-alt me-1"></i>Login
          </a>
          <a href="/login#signup" class="btn btn-primary">
            <i class="fas fa-user-plus me-1"></i>Sign Up
          </a>
        `;
      }
    }
  }
  
  // Populate favorites page
  function populateFavorites(favorites) {
    const favoritesContainer = document.getElementById('favorites-list');
    
    if (!favoritesContainer) {
      console.error('Favorites container not found');
      return;
    }
  
    if (!favorites || favorites.length === 0) {
      favoritesContainer.innerHTML = '<p>No favorites yet. Start adding movies!</p>';
      return;
    }
  
    // Clear existing content
    favoritesContainer.innerHTML = '';
  
    // Create cards for each favorite movie
    favorites.forEach(movie => {
      const movieCard = document.createElement('div');
      movieCard.className = 'movie-card';
      movieCard.innerHTML = `
        <img src="${movie.poster}" alt="${movie.title}" class="movie-poster">
        <div class="movie-info">
          <h3 class="movie-title">${movie.title} (${movie.year})</h3>
          <p class="movie-description">${movie.description || 'No description available'}</p>
          <button class="btn btn-danger remove-favorite" data-movie-id="${movie.id}">
            Remove from Favorites
          </button>
        </div>
      `;
  
      // Add event listener to remove button
      const removeButton = movieCard.querySelector('.remove-favorite');
      removeButton.addEventListener('click', function() {
        removeFavorite(movie.id);
      });
  
      favoritesContainer.appendChild(movieCard);
    });
  }
  
  // Remove favorite movie
  function removeFavorite(movieId) {
    makeAuthenticatedRequest('/api/user/favorites', {
      method: 'DELETE',
      body: JSON.stringify({ movieId })
    })
    .then(response => response.json())
    .then(data => {
      // Refresh favorites list
      checkAuthStatus();
    })
    .catch(error => {
      console.error('Error removing favorite:', error);
      alert('Failed to remove movie from favorites');
    });
  }
  
  // Populate watchlist page
  function populateWatchlist(watchlist) {
    const watchlistContainer = document.getElementById('watchlist');
    
    if (!watchlistContainer) {
      console.error('Watchlist container not found');
      return;
    }
  
    if (!watchlist || watchlist.length === 0) {
      watchlistContainer.innerHTML = '<p>Your watchlist is empty. Start adding movies!</p>';
      return;
    }
  
    // Clear existing content
    watchlistContainer.innerHTML = '';
  
    // Create cards for each watchlist movie
    watchlist.forEach(movie => {
      const movieCard = document.createElement('div');
      movieCard.className = 'movie-card';
      movieCard.innerHTML = `
        <img src="${movie.poster}" alt="${movie.title}" class="movie-poster">
        <div class="movie-info">
          <h3 class="movie-title">${movie.title} (${movie.year})</h3>
          <p class="movie-description">${movie.description || 'No description available'}</p>
          <button class="btn btn-danger remove-watchlist" data-movie-id="${movie.id}">
            Remove from Watchlist
          </button>
        </div>
      `;
  
      // Add event listener to remove button
      const removeButton = movieCard.querySelector('.remove-watchlist');
      removeButton.addEventListener('click', function() {
        removeFromWatchlist(movie.id);
      });
  
      watchlistContainer.appendChild(movieCard);
    });
  }
  
  // Remove movie from watchlist
  function removeFromWatchlist(movieId) {
    makeAuthenticatedRequest('/api/user/watchlist', {
      method: 'DELETE',
      body: JSON.stringify({ movieId })
    })
    .then(response => response.json())
    .then(data => {
      // Refresh watchlist
      checkAuthStatus();
    })
    .catch(error => {
      console.error('Error removing from watchlist:', error);
      alert('Failed to remove movie from watchlist');
    });
  }
  
  // Logout function
  function logout() {
    // Remove token from local storage
    localStorage.removeItem('token');
    
    // Redirect to login page
    window.location.href = '/login';
  }
  
  // Login form submission
  function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => {
      if (data.token) {
        // Save token to local storage
        localStorage.setItem('token', data.token);
        
        // Redirect to home page
        window.location.href = '/';
      } else {
        // Show error message
        alert(data.error || 'Login failed');
      }
    })
    .catch(error => {
      console.error('Login error:', error);
      alert('An error occurred during login');
    });
  }
  
  // Signup form submission
  function handleSignup(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, email, password })
    })
    .then(response => response.json())
    .then(data => {
      if (data.token) {
        // Save token to local storage
        localStorage.setItem('token', data.token);
        
        // Redirect to home page
        window.location.href = '/';
      } else {
        // Show error message
        alert(data.error || 'Signup failed');
      }
    })
    .catch(error => {
      console.error('Signup error:', error);
      alert('An error occurred during signup');
    });
  }
  
  // Event listeners for login and signup pages
  document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }
    
    if (signupForm) {
      signupForm.addEventListener('submit', handleSignup);
    }
  });
  
  // Export functions if needed for other scripts
  window.authUtils = {
    getAuthToken,
    makeAuthenticatedRequest,
    logout
  };
  // Add these functions to your existing auth-frontend.js

// Function to add movie to favorites
function addToFavorites(movie) {
    return makeAuthenticatedRequest('/api/user/favorites/add', {
      method: 'POST',
      body: JSON.stringify({ movie })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to add movie to favorites');
      }
      return response.json();
    })
    .then(data => {
      console.log('Added to favorites:', data);
      checkAuthStatus();
      return data;
    })
    .catch(error => {
      console.error('Error adding to favorites:', error);
      alert('Failed to add movie to favorites');
    });
  }
  
  // Function to remove movie from favorites
  function removeFavorite(movieId) {
    return makeAuthenticatedRequest('/api/user/favorites/remove', {
      method: 'POST',
      body: JSON.stringify({ movieId })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to remove movie from favorites');
      }
      return response.json();
    })
    .then(data => {
      console.log('Removed from favorites:', data);
      checkAuthStatus();
      return data;
    })
    .catch(error => {
      console.error('Error removing from favorites:', error);
      alert('Failed to remove movie from favorites');
    });
  }
  
  // Function to add movie to watchlist
  function addToWatchlist(movie) {
    return makeAuthenticatedRequest('/api/user/watchlist/add', {
      method: 'POST',
      body: JSON.stringify({ movie })
    })
    .then(response => {
      console.log('Response:', response);
      if (!response.ok) {
        throw new Error('Failed to add movie to watchlist');
      }
      return response.json();
    })
    .then(data => {
      console.log('Added to watchlist:', data);
      checkAuthStatus();
      return data;
    })
    .catch(error => {
      console.error('Error adding to watchlist:', error);
      alert('Failed to add movie to watchlist');
    });
  }
  
  // Function to remove movie from watchlist
  function removeFromWatchlist(movieId) {
    return makeAuthenticatedRequest('/api/user/watchlist/remove', {
      method: 'POST',
      body: JSON.stringify({ movieId })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to remove movie from watchlist');
      }
      return response.json();
    })
    .then(data => {
      console.log('Removed from watchlist:', data);
      checkAuthStatus();
      return data;
    })
    .catch(error => {
      console.error('Error removing from watchlist:', error);
      alert('Failed to remove movie from watchlist');
    });
  }
  
  // Update the window.authUtils object to include these functions
  window.authUtils = {
    ...window.authUtils,
    addToFavorites,
    removeFavorite,
    addToWatchlist,
    removeFromWatchlist
  };