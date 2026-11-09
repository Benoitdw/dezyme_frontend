FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
# The app is built with base path /dezyme (svelte.config.js): serve it from
# the matching folder so /dezyme/_app/... resolves to real files.
COPY --from=builder /app/build /usr/share/nginx/html/dezyme
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
