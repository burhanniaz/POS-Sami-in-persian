# Stage 1 — build the static Vite bundle
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_API_URL is baked into the JS bundle at build time (Vite convention),
# not read at container start time — it MUST be passed as a Docker build
# arg, not just a runtime env var. See deployment guide for how to set this
# in EasyPanel's "Build Arguments" for this service.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2 — serve the built dist/ folder with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
