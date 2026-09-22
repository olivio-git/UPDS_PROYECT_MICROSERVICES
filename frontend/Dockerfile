# Build the static bundle.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --legacy-peer-deps: react-day-picker@8 declares date-fns ^2||^3 and the project
# uses date-fns@4. Remove once react-day-picker is upgraded.
RUN npm ci --legacy-peer-deps
COPY . .
# No API URLs are baked in: the app calls the host that serves it, and the
# gateway proxies /api/v1 and /minio. Override with VITE_* only if the API
# lives somewhere else.
RUN npm run build

# Serve it.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
