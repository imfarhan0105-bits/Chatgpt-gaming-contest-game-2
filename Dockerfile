FROM node:24-slim

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy application source code
COPY . .

# Build frontend static bundle
RUN pnpm run build:client

ENV PORT=3000
EXPOSE 3000

# Start unified authoritative server
CMD ["node", "--experimental-strip-types", "src/server/index.ts"]
