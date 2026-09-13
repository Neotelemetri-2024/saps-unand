# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache openssl python3 make g++

# Copy package files & install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript to dist
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime dependencies for Prisma & Canvas/PDF
RUN apk add --no-cache openssl fontconfig

# Copy node_modules & generated prisma client from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/uploads ./uploads
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/firebase-adminsdk.json* ./

# Expose API port
EXPOSE 3000

# Start backend server
CMD ["npm", "start"]
