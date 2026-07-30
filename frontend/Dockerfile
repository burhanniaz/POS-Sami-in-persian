FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY templates/default.conf.template /etc/nginx/templates/default.conf.template

# Defaults so the image still runs standalone (e.g. `docker run`) without extra config.
# Override BACKEND_HOST/BACKEND_PORT per environment - docker-compose, EasyPanel, etc -
# nginx re-renders this template from env vars on every container start.
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=4000

EXPOSE 80
