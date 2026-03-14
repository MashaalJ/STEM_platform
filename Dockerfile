# Build stage: install deps and build frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx
COPY --from=builder /app/dist ./dist
COPY server.ts ./
COPY tsconfig.json ./
EXPOSE 8080
ENV PORT=8080
CMD ["npx", "tsx", "server.ts"]
