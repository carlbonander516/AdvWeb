# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files from the backend folder
COPY backend/package*.json ./

# Install dependencies
RUN npm install

# Copy the backend code into the container
COPY backend/ ./

# Copy the data folder (from the project root) into the container
COPY data/ ./data/

# Expose the port your app listens on
EXPOSE 3000

# Start the Node.js application
CMD ["node", "server.js"]
