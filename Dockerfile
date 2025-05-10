# Use Node.js base image
FROM node:23-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Expose port and start the app
EXPOSE 3000
CMD ["node", "index.js"]
