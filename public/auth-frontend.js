// auth-frontend.js - Frontend authentication utility functions

// Check if user is logged in
function isLoggedIn() {
  return localStorage.getItem('token') !== null;
}

// Get current user
function getCurrentUser() {
  const userJson = localStorage.getItem('user');
  return userJson ? JSON.parse(userJson) : null;
}

// Log out user
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

// Add authentication header to fetch requests
function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  if (!token) {
    return Promise.reject(new Error('No authentication token found'));
  }

  const authOptions = {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  };

  return fetch(url, authOptions).then(response => {
    if (response.status === 401 || response.status === 403) {
      logout();
      throw new Error('Your session has expired. Please log in again.');
    }
    return response;
  });
}

// Update UI based on authentication status
function updateAuthUI() {
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');

  if (token && userJson) {
    // User is logged in
    const user = JSON.parse(userJson);

    // Show authenticated elements
    document.querySelectorAll('.auth-required').forEach(el => {
      el.style.display = 'block';
    });

    // Show user dropdown, hide login/signup buttons
    document.querySelectorAll('.auth-guest').forEach(el => {
      el.style.display = 'none';
    });

    document.querySelectorAll('.auth-user').forEach(el => {
      el.style.display = 'block';
    });

    // Set username in dropdown
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) {
      usernameDisplay.textContent = user.username;
    }
  } else {
    // User is not logged in
    document.querySelectorAll('.auth-required').forEach(el => {
      el.style.display = 'none';
    });

    document.querySelectorAll('.auth-guest').forEach(el => {
      el.style.display = 'block';
    });

    document.querySelectorAll('.auth-user').forEach(el => {
      el.style.display = 'none';
    });
  }
}

// Add movie to favorites
function addToFavorites(movie) {
  if (!movie || !movie.id) {
    return Promise.reject(new Error('Invalid movie data'));
  }

  return authFetch('/api/user/favorites/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
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
      updateAuthUI();
      return data;
    })
    .catch(error => {
      console.error('Error adding to favorites:', error);
      alert(error.message || 'Failed to add movie to favorites');
      throw error;
    });
}

// Remove movie from favorites
function removeFromFavorites(movieId) {
  if (!movieId) {
    return Promise.reject(new Error('Movie ID is required'));
  }

  return authFetch('/api/user/favorites/remove', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
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
      updateAuthUI();
      return data;
    })
    .catch(error => {
      console.error('Error removing from favorites:', error);
      alert(error.message || 'Failed to remove movie from favorites');
      throw error;
    });
}

// Get user's favorites
function getFavorites() {
  return authFetch('/api/user/favorites')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to get favorites');
      }
      return response.json();
    })
    .then(data => data.favorites || [])
    .catch(error => {
      console.error('Error getting favorites:', error);
      throw error;
    });
}

// Add movie to watchlist
function addToWatchlist(movie) {
  if (!movie || !movie.id) {
    return Promise.reject(new Error('Invalid movie data'));
  }

  return authFetch('/api/user/watchlist/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ movie })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to add movie to watchlist');
      }
      return response.json();
    })
    .then(data => {
      console.log('Added to watchlist:', data);
      updateAuthUI();
      return data;
    })
    .catch(error => {
      console.error('Error adding to watchlist:', error);
      alert(error.message || 'Failed to add movie to watchlist');
      throw error;
    });
}

// Remove movie from watchlist
function removeFromWatchlist(movieId) {
  if (!movieId) {
    return Promise.reject(new Error('Movie ID is required'));
  }

  return authFetch('/api/user/watchlist/remove', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
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
      updateAuthUI();
      return data;
    })
    .catch(error => {
      console.error('Error removing from watchlist:', error);
      alert(error.message || 'Failed to remove movie from watchlist');
      throw error;
    });
}

// Get user's watchlist
function getWatchlist() {
  return authFetch('/api/user/watchlist')
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.error || 'Failed to get watchlist');
        });
      }
      return response.json();
    })
    .then(data => {
      if (!data || !Array.isArray(data.watchlist)) {
        console.warn('Invalid watchlist data received:', data);
        return [];
      }
      return data.watchlist;
    })
    .catch(error => {
      console.error('Error getting watchlist:', error);
      // Don't show alert for this error as it's likely a background operation
      return [];
    });
}

// Initialize auth functions when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  updateAuthUI();

  // Add logout handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      logout();
    });
  }
});