#!/bin/bash

# Create necessary directories
mkdir -p routes
mkdir -p data

# Install required packages
echo "Installing required packages..."
npm install bcryptjs jsonwebtoken

# Check if JWT_SECRET is in .env
if ! grep -q "JWT_SECRET" .env; then
  echo "Adding JWT_SECRET to .env file..."
  # Generate a random JWT secret
  JWT_SECRET=$(openssl rand -hex 32)
  echo "JWT_SECRET=$JWT_SECRET" >> .env
fi

# Copy login.html to project root
echo "Setting up login page..."
cp login.html .

echo "Authentication setup complete!"
echo "Start your server with: node server.js"