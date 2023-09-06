# Use the official Node.js LTS image as the base image
FROM node:18

# Set the working directory for the app
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Install better-sqlite3 separately
RUN npm install better-sqlite3

# Copy only the compiled .js files and node_modules directory
COPY dist/*.js ./dist/
COPY dist/schemas/*.json ./dist/schemas/

# Expose port and start application
EXPOSE 8080
CMD [ "npm", "start" ]
