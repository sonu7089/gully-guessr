# Gully Guessr: one container serves the built site and the multiplayer WebSocket on $PORT.
# VITE_* values are public (they end up in the browser bundle), so they are passed as build args.

FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_MAPILLARY_ACCESS_TOKEN
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src ./src
COPY tsconfig*.json ./
USER node
EXPOSE 8080
CMD ["node_modules/.bin/tsx", "server/index.ts"]
