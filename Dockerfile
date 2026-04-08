# Futurescape - Multi-stage Docker build
# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for API keys (passed at build time)
ARG VITE_DEEPSEEK_API_KEY
ARG VITE_OPENAI_API_KEY
ARG VITE_GROQ_API_KEY
ARG VITE_GEMINI_API_KEY
ARG VITE_CLAUDE_API_KEY
ARG VITE_OPENROUTER_API_KEY

# Set environment variables for build
ENV VITE_DEEPSEEK_API_KEY=$VITE_DEEPSEEK_API_KEY
ENV VITE_OPENAI_API_KEY=$VITE_OPENAI_API_KEY
ENV VITE_GROQ_API_KEY=$VITE_GROQ_API_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
ENV VITE_CLAUDE_API_KEY=$VITE_CLAUDE_API_KEY
ENV VITE_OPENROUTER_API_KEY=$VITE_OPENROUTER_API_KEY

# Build the application
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
