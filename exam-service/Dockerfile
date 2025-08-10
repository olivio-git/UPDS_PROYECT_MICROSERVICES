FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create necessary directories
RUN mkdir -p logs uploads

# Run as non-root user
USER node

# Expose port
EXPOSE 3003

# Start the service
CMD ["node", "dist/index.js"]