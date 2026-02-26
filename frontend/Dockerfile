FROM node:18-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# The source code will be mounted as a volume so we don't need to copy it during dev
# But we copy it here as a fallback for production
COPY . .

EXPOSE 3000

# Start the Vite development server and expose it to the network
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "3000"]
