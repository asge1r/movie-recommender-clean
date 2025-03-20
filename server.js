// Add this at the very beginning of server.js file
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Serve static files from the public directory and current directory
app.use(express.static('public'));
app.use(express.static('./'));

// Ensure necessary directories exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Import auth and user routes
const auth = require('./auth');
const userRoutes = require('./user');

// Register routes
app.use('/api/auth', auth.router);
app.use('/api/user', userRoutes);

// Add routes to serve the HTML pages
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/favorites', (req, res) => {
  res.sendFile(path.join(__dirname, 'favorites.html'));
});

app.get('/watchlist', (req, res) => {
  res.sendFile(path.join(__dirname, 'watchlist.html'));
});

// LLM provider configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama'; // 'ollama' or 'together'
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// Together AI API key (kept as fallback)
const TOGETHER_AI_API_KEY = "b97128da1c42e229ee7a40238851f6277815198e8ccd27b5aaec1bd6d0fb5aaf";
const TOGETHER_AI_API_URL = "https://api.together.xyz/v1/completions";

// Movie data storage
let moviesWithDescriptions = [];
let processedMovies = [];
let processedReviews = [];

// Load CSV files on startup
function loadCSVData() {
  // Load movies with descriptions
  fs.createReadStream('./data/movies_with_descriptions.csv')
    .pipe(csv())
    .on('data', (data) => {
      // Clean up data
      moviesWithDescriptions.push({
        movie_id: data.movie_id,
        name: data.name,
        year: data.year,
        rating: data.rating,
        genres: data.genres.trim(),
        description: data.description || 'No description available',
        imdb_id: data.imdb_id || ''
      });
    })
    .on('end', () => {
      console.log(`Loaded ${moviesWithDescriptions.length} movies with descriptions`);
    })
    .on('error', (error) => {
      console.error('Error loading movies_with_descriptions.csv:', error);
    });

  // Load processed movies (used as a fallback)
  fs.createReadStream('./data/processed_movies.csv')
    .pipe(csv())
    .on('data', (data) => processedMovies.push(data))
    .on('end', () => {
      console.log(`Loaded ${processedMovies.length} processed movies`);
    })
    .on('error', (error) => {
      console.error('Error loading processed_movies.csv:', error);
    });

  // Load processed reviews
  fs.createReadStream('./data/processed_reviews.csv')
    .pipe(csv())
    .on('data', (data) => processedReviews.push(data))
    .on('end', () => {
      console.log(`Loaded ${processedReviews.length} processed reviews`);
    })
    .on('error', (error) => {
      console.error('Error loading processed_reviews.csv:', error);
    });
}

// API endpoint to get movies for autocomplete
app.get('/api/movies', (req, res) => {
  const movies = moviesWithDescriptions.map(movie => ({
    id: movie.movie_id,
    title: movie.name,
    year: movie.year
  }));
  res.json(movies);
});

// Get movie details by ID
app.get('/api/movies/:id', (req, res) => {
  const movieId = req.params.id;
  const movie = moviesWithDescriptions.find(m => m.movie_id === movieId);
  
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found' });
  }
  
  // Get reviews for this movie
  const reviews = processedReviews.filter(r => r.movie_id === movieId)
    .sort((a, b) => b.helpful - a.helpful)
    .slice(0, 5);
  
  res.json({
    ...movie,
    reviews
  });
});

// Get representative reviews for a movie
function getRepresentativeReviews(movieId, count = 5) {
  // Filter reviews for this movie
  const movieReviews = processedReviews.filter(review => review.movie_id == movieId);
  
  if (movieReviews.length === 0) {
    return [];
  }
  
  // Calculate helpfulness ratio
  movieReviews.forEach(review => {
    review.helpful_ratio = parseFloat(review.helpful) / (parseFloat(review.total) || 1);
  });
  
  // Sort by helpfulness
  const sortedReviews = movieReviews.sort((a, b) => b.helpful_ratio - a.helpful_ratio);
  
  // Get top helpful reviews
  return sortedReviews.slice(0, count);
}

// Clean review text
function cleanReviewText(text) {
  if (!text) return '';
  
  // Remove HTML line breaks
  return text.replace(/<br\/>/g, ' ').replace(/<br>/g, ' ')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Get movies based on similarity
function getSimilarMovies(inputTitles, genre, year, rating, count = 10) {
  // Filter movies based on criteria
  let filteredMovies = [...moviesWithDescriptions];
  
  // Apply genre filter
  if (genre) {
    filteredMovies = filteredMovies.filter(movie => 
      movie.genres.toLowerCase().includes(genre.toLowerCase())
    );
  }
  
  // Apply year filter
  if (year) {
    if (year === 'pre-1970') {
      filteredMovies = filteredMovies.filter(movie => parseInt(movie.year) < 1970);
    } else if (year.includes('-')) {
      const [startYear, endYear] = year.split('-').map(y => parseInt(y));
      filteredMovies = filteredMovies.filter(movie => {
        const movieYear = parseInt(movie.year);
        return movieYear >= startYear && movieYear <= endYear;
      });
    }
  }
  
  // Apply rating filter
  if (rating) {
    const minRating = parseFloat(rating);
    filteredMovies = filteredMovies.filter(movie => parseFloat(movie.rating) >= minRating);
  }
  
  // Remove input movies from results
  const inputMovieTitles = inputTitles.map(title => {
    // Extract just the title without year if in format "Title (Year)"
    const match = title.match(/^(.*?)(?:\s*\(\d{4}\))?$/);
    return match ? match[1].toLowerCase() : title.toLowerCase();
  });
  
  filteredMovies = filteredMovies.filter(movie => 
    !inputMovieTitles.some(title => movie.name.toLowerCase().includes(title))
  );
  
  // Sort by rating (highest first) and take requested count
  return filteredMovies.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, count);
}

// Create LLM prompt
function createLLMPrompt(inputMovies, similarMovies, userMessage = '', genre = '', year = '', rating = '', userMood = '') {
  // Format input movies
  const inputMoviesList = inputMovies.join(', ');
  
  // Format similar movies with details
  const movieCandidates = similarMovies.map(movie => {
    // Get some representative reviews
    const reviews = getRepresentativeReviews(movie.movie_id, 2);
    const reviewTexts = reviews.map(r => cleanReviewText(r.review).substring(0, 150)).join(' ');
    
    return `- "${movie.name}" (${movie.year}) - Rating: ${movie.rating}/10
   Genres: ${movie.genres}
   Plot: ${movie.description.substring(0, 200)}
   Reviews: ${reviewTexts || 'No reviews available'}`;
  }).join('\n\n');
  
  // Construct base prompt
  let prompt = `You are a helpful movie recommendation assistant. I'll provide you with movies a user likes and potential recommendations.

USER LIKES: ${inputMoviesList}`;

  // Add filters if present
  if (genre || year || rating) {
    prompt += "\nFILTERS:";
    if (genre) prompt += ` Genre: ${genre},`;
    if (year) prompt += ` Year: ${year},`;
    if (rating) prompt += ` Minimum Rating: ${rating}+/10,`;
    prompt = prompt.replace(/,$/, ''); // Remove trailing comma
  }
  
  // Add user mood if present
  if (userMood) {
    prompt += `\n\nUSER MOOD: ${userMood}`;
  }
  
  // Add user message if present
  if (userMessage) {
    prompt += `\n\nUSER SAYS: "${userMessage}"`;
  }
  
  prompt += `\n\nPOTENTIAL RECOMMENDATIONS:\n${movieCandidates}

  Based on the user's liked movies${genre ? ', genre preference' : ''}${year ? ', year preference' : ''}${rating ? ', rating preference' : ''}${userMood ? ', current mood' : ''}, and the potential recommendations, select the 5 best movies for them.
  
  For each recommendation, provide:
  1. Title and year
  2. A brief reason why this movie would appeal to someone who enjoyed ${inputMoviesList}${userMood ? ' and is currently feeling ' + userMood : ''}
  3. Mention specific elements like themes, style, emotional impact, or storytelling that connect it to the user's preferences
  4. Keep explanations concise but insightful
  5. Format your response as numbered recommendations (1-5)
  
  Start with a brief personalized message and end with a follow-up question.`;
  
    return prompt;
  }
  
  // Call LLM API with provider selection
  async function callLLM(prompt) {
    if (LLM_PROVIDER === 'ollama') {
      try {
        console.log('Using Ollama for LLM request');
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
          model: OLLAMA_MODEL,
          prompt: prompt,
          stream: false
        });
        
        return response.data.response;
      } catch (error) {
        console.error('Error calling Ollama API:', error.message);
        if (error.response) {
          console.error('Response data:', error.response.data);
          console.error('Response status:', error.response.status);
        }
        
        // Try fallback to Together AI if Ollama fails
        if (process.env.ENABLE_FALLBACK === 'true') {
          console.log('Falling back to Together.ai');
          return callTogetherAI(prompt);
        }
        
        throw error;
      }
    } else {
      return callTogetherAI(prompt);
    }
  }
  
  // Together AI implementation (kept as a fallback)
  async function callTogetherAI(prompt) {
    try {
      const response = await axios.post(
        TOGETHER_AI_API_URL,
        {
          model: "mistralai/Mistral-7B-Instruct-v0.1",
          prompt: prompt,
          max_tokens: 1024,
          temperature: 0.7,
          top_p: 0.8
        },
        {
          headers: {
            "Authorization": `Bearer ${TOGETHER_AI_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      return response.data.choices[0].text;
    } catch (error) {
      console.error("Error calling Together.ai API:", error.response ? error.response.data : error.message);
      throw error;
    }
  }
  
  // Chat with the LLM about movies
  app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    
    try {
      // Get context from chat history
      let likedMovies = [];
      let genre = '';
      let year = '';
      let rating = '';
      
      // Extract context from history
      if (history && history.length > 0) {
        for (const entry of history) {
          if (entry.type === 'recommendation' && entry.movies) {
            likedMovies = entry.movies;
          }
          if (entry.filters) {
            genre = entry.filters.genre || '';
            year = entry.filters.year || '';
            rating = entry.filters.rating || '';
          }
        }
      }
      
      // Create prompt
      const prompt = `User: ${message}\n\nAssistant:`;
      
      // Call LLM
      const llmResponse = await callLLM(prompt);
      
      res.json({ response: llmResponse });
    } catch (error) {
      console.error('Error in chat endpoint:', error);
      res.status(500).json({ 
        error: 'Failed to get response from LLM', 
        message: 'Our recommendation service is currently unavailable. Please try again later.'
      });
    }
  });
  
  // Enhanced recommendation API endpoint
  app.post('/api/recommend', async (req, res) => {
    const { movies, genre, year, rating, message } = req.body;
    
    try {
      // Get similar movies from our dataset
      const similarMovies = getSimilarMovies(movies, genre, year, rating, 15);
      
      // Create prompt for LLM
      const prompt = createLLMPrompt(movies, similarMovies, message, genre, year, rating);
      
      // Call LLM
      const llmResponse = await callLLM(prompt);
      
      // Process LLM response to add movie data
      const enhancedResponse = await enhanceResponseWithMovieData(llmResponse, similarMovies);
      
      res.json({ 
        recommendations: llmResponse,
        enhancedResponse: enhancedResponse,
        conversational: true
      });
    } catch (error) {
      console.error('Error generating recommendations:', error);
      
      // Fallback to basic recommendations
      const similarMovies = getSimilarMovies(movies, genre, year, rating, 5);
      const basicRecommendations = similarMovies.map((movie, index) => 
        formatRecommendation(movie, movies, index + 1)
      ).join('\n\n');
      
      res.json({ 
        recommendations: basicRecommendations,
        conversational: false,
        error: error.message
      });
    }
  });
  
  // Extract movie titles from LLM response
  function extractMovieTitles(llmResponse) {
    const titles = [];
    // Look for patterns like "1. Title (year)" or numbered lists with titles
    const regex = /\d+\.\s+["']?([^"'\(\n]+)(?:\s*\((\d{4})\))?/g;
    let match;
    
    while ((match = regex.exec(llmResponse)) !== null) {
      const title = match[1].trim();
      const year = match[2] || '';
      titles.push({ title, year });
    }
    
    return titles;
  }
  
  // Enhance LLM response with movie data
  async function enhanceResponseWithMovieData(llmResponse, similarMovies) {
    // Extract movie titles from response
    const recommendedTitles = extractMovieTitles(llmResponse);
    
    // Find matching movies in our database
    const enhancedMovies = recommendedTitles.map(rec => {
      // Try to find exact match first
      let match = similarMovies.find(m => 
        m.name.toLowerCase() === rec.title.toLowerCase() && 
        (!rec.year || m.year.toString() === rec.year)
      );
      
      // If no exact match, try fuzzy matching
      if (!match) {
        match = similarMovies.find(m => 
          m.name.toLowerCase().includes(rec.title.toLowerCase()) ||
          rec.title.toLowerCase().includes(m.name.toLowerCase())
        );
      }
      
      // If we found a match, return it with poster
      if (match) {
        return {
          title: match.name,
          year: match.year,
          director: "Various Directors", // We don't have this in our dataset
          rating: match.rating,
          description: match.description || "No description available",
          poster: getMoviePoster(match.imdb_id),
          genres: match.genres,
          id: match.movie_id
        };
      }
      
      // If no match found, return null
      return null;
    }).filter(m => m !== null); // Remove nulls
    
    return enhancedMovies;
  }
  
  // Format the recommendation in LLM-like style (fallback method)
  function formatRecommendation(movie, inputMovies, index) {
    // Get top reviews
    const reviews = getRepresentativeReviews(movie.movie_id, 2);
    
    // Extract insights from reviews
    let reviewInsights = '';
    if (reviews && reviews.length > 0) {
      const cleanedReviews = reviews.map(r => cleanReviewText(r.review).substring(0, 200));
      reviewInsights = `Based on audience reviews, ${cleanedReviews.join(' ')}`;
    }
    
    // Generate a reason based on input movies and genre
    const genreList = movie.genres.split('  ').filter(g => g.trim()).join(', ');
    const reason = `If you enjoyed ${inputMovies.join(' and ')}, you'll appreciate ${movie.name}'s similar ${genreList} elements. ${reviewInsights}`;
    
    return `${index}. ${movie.name} (${movie.year})
  Director: Various Directors
  Rating: ${movie.rating}/10
  
  Synopsis: ${movie.description}
  
  Why you might like it: ${reason}`;
  }
  
  // Helper function to get movie poster URL
  function getMoviePoster(imdbId) {
    if (imdbId) {
      return `https://img.omdbapi.com/?i=${imdbId}&apikey=trilogy&h=400`;
    }
    
    // Fallback posters for when we don't have an IMDb ID
    const fallbackPosters = [
      'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_.jpg',
      'https://m.media-amazon.com/images/M/MV5BMjIxNTU4MzY4MF5BMl5BanBnXkFtZTgwMzM4ODI3MjE@._V1_.jpg',
      'https://m.media-amazon.com/images/M/MV5BYWZjMjk3ZTItODQ2ZC00NTY5LWE0ZDYtZTI3MjcwN2Q5NTVkXkEyXkFqcGdeQXVyODk4OTc3MTY@._V1_.jpg',
      'https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_.jpg',
      'https://m.media-amazon.com/images/M/MV5BZjdkOTU3MDktN2IxOS00OGEyLWFmMjktY2FiMmZkNWIyODZiXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_.jpg'
    ];
    
    return fallbackPosters[Math.floor(Math.random() * fallbackPosters.length)];
  }
  
  // Check Ollama availability on startup
  async function checkOllamaAvailability() {
    if (LLM_PROVIDER === 'ollama') {
      try {
        const response = await axios.get(`${OLLAMA_URL}/api/tags`);
        const models = response.data.models || [];
        const hasRequiredModel = models.some(model => model.name === OLLAMA_MODEL);
        
        if (!hasRequiredModel) {
          console.warn(`Warning: Ollama is running but the model '${OLLAMA_MODEL}' is not available.`);
          console.warn(`Available models: ${models.map(m => m.name).join(', ')}`);
          console.warn(`Pulling the required model '${OLLAMA_MODEL}'...`);
          
          try {
            // Try to pull the model
            await axios.post(`${OLLAMA_URL}/api/pull`, {
              name: OLLAMA_MODEL
            });
            console.log(`Successfully pulled model '${OLLAMA_MODEL}'`);
          } catch (pullError) {
            console.error(`Failed to pull model '${OLLAMA_MODEL}':`, pullError.message);
            console.warn(`Will use fallback methods if needed.`);
          }
        } else {
          console.log(`Ollama is running with the required model '${OLLAMA_MODEL}'`);
        }
      } catch (error) {
        console.warn('Warning: Ollama service is not available:', error.message);
        console.warn('Starting without Ollama. Please make sure Ollama is running for full functionality.');
        console.warn('Run "ollama serve" in a separate terminal to start Ollama.');
        
        // If Ollama is not available, set fallback provider
        if (process.env.ENABLE_FALLBACK === 'true') {
          console.log('Setting LLM provider to fallback option (Together.ai)');
          LLM_PROVIDER = 'together';
        }
      }
    }
  }
  // Enhanced recommendation API endpoint
app.post('/api/recommend', async (req, res) => {
    const { movies, genre, year, rating, message, mood } = req.body;
    
    try {
      // Get similar movies from our dataset
      const similarMovies = getSimilarMovies(movies, genre, year, rating, 15);
      
      // Create prompt for LLM with user mood
      const prompt = createLLMPrompt(movies, similarMovies, message, genre, year, rating, mood);
      
      // Call LLM
      const llmResponse = await callLLM(prompt);
      
      // Process LLM response to add movie data
      const enhancedResponse = await enhanceResponseWithMovieData(llmResponse, similarMovies);
      
      // Create a session object with all recommendation data
      const recommendationContext = {
        userInput: { movies, genre, year, rating, message, mood },
        recommendations: llmResponse,
        timestamp: new Date().toISOString()
      };
      
      // Store in a global variable for the session
      global.lastRecommendationContext = recommendationContext;
      
      res.json({ 
        recommendations: llmResponse,
        enhancedResponse: enhancedResponse,
        conversational: true
      });
    } catch (error) {
      console.error('Error generating recommendations:', error);
      
      // Fallback to basic recommendations
      const similarMovies = getSimilarMovies(movies, genre, year, rating, 5);
      const basicRecommendations = similarMovies.map((movie, index) => 
        formatRecommendation(movie, movies, index + 1)
      ).join('\n\n');
      
      res.json({ 
        recommendations: basicRecommendations,
        conversational: false,
        error: error.message
      });
    }
  });
  // Chat with the LLM about movies
app.post('/api/chat', async (req, res) => {
    const { message, history, context } = req.body;
    
    try {
      // Get context from chat history
      let likedMovies = [];
      let chatMessages = [];
      let genre = '';
      let year = '';
      let rating = '';
      let mood = '';
      let seenMovies = [];
      let favorites = [];
      
      // Extract context and chat history
      if (history && history.length > 0) {
        // Get the last few messages for chat context (limit to 10 exchanges)
        const recentHistory = history.slice(-10);
        chatMessages = recentHistory
          .filter(entry => entry.type === 'user' || entry.type === 'bot')
          .map(entry => `${entry.type === 'user' ? 'User' : 'Assistant'}: ${entry.message}`);
        
        // Extract recommendation context
        for (const entry of history) {
          if (entry.type === 'recommendation' && entry.movies) {
            likedMovies = entry.movies;
          }
          if (entry.filters) {
            genre = entry.filters.genre || '';
            year = entry.filters.year || '';
            rating = entry.filters.rating || '';
            mood = entry.filters.mood || '';
          }
        }
      }
      
      // Get additional context from request if provided
      if (context) {
        if (context.seenMovies && Array.isArray(context.seenMovies)) {
          seenMovies = context.seenMovies;
        }
        if (context.favorites && Array.isArray(context.favorites)) {
          favorites = context.favorites;
        }
        if (context.mood) {
          mood = context.mood;
        }
      }
      
      // Add recommendation context if it exists
      let recommendationContext = "";
      if (global.lastRecommendationContext) {
        const recContext = global.lastRecommendationContext;
        recommendationContext = `I previously recommended these movies based on your interest in ${recContext.userInput.movies.join(', ')}:\n\n${recContext.recommendations}\n\n`;
      }
      
      // Add user preference context
      let userPreferenceContext = "";
      if (seenMovies.length > 0 || favorites.length > 0 || mood) {
        userPreferenceContext = "User preferences:\n";
        
        if (favorites.length > 0) {
          userPreferenceContext += `- Favorite movies: ${favorites.join(', ')}\n`;
        }
        
        if (seenMovies.length > 0) {
          userPreferenceContext += `- Recently seen movies: ${seenMovies.join(', ')}\n`;
        }
        
        if (mood) {
          userPreferenceContext += `- Current mood: ${mood}\n`;
        }
        
        userPreferenceContext += "\n";
      }
      
      // Create prompt with all context
      let prompt = "You are a helpful movie recommendation assistant. ";
      
      // Add chat history context if available
      if (chatMessages.length > 0) {
        prompt += "Here's our recent conversation:\n\n";
        prompt += chatMessages.join('\n') + '\n\n';
      }
      
      // Add user preferences and recommendation context
      prompt += userPreferenceContext;
      prompt += recommendationContext;
      
      // Add current user message
      prompt += `User: ${message}\n\nAssistant:`;
      
      // Call LLM
      const llmResponse = await callLLM(prompt);
      
      res.json({ response: llmResponse });
    } catch (error) {
      console.error('Error in chat endpoint:', error);
      res.status(500).json({ 
        error: 'Failed to get response from LLM', 
        message: 'Our recommendation service is currently unavailable. Please try again later.'
      });
    }
  });
  // Helper to clear recommendation context
app.post('/api/clear-context', (req, res) => {
    global.lastRecommendationContext = null;
    res.json({ success: true, message: 'Context cleared' });
  });
  
  // Serve the index.html file
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
  
  // Start the server
  app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    loadCSVData();
    await checkOllamaAvailability();
  });