FROM node:22-slim

WORKDIR /app

# Force public npm registry
RUN npm config set registry https://registry.npmjs.org/

# Copy package files
COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/electron-app/package.json packages/electron-app/

# Install dependencies
RUN npm ci

# Copy source
COPY packages/shared packages/shared
COPY packages/backend packages/backend

# Build
RUN npm run build:shared && npm run build:backend

EXPOSE 3000

CMD ["node", "packages/backend/dist/index.js"]
