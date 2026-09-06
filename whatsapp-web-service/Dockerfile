FROM node:20-bookworm-slim

# Locale and dbus help Chrome for Testing start cleanly in containers.
ENV LANG=en_US.UTF-8
ENV DBUS_SESSION_BUS_ADDRESS=autolaunch:

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    dbus \
    fonts-freefont-ttf \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV WWEBJS_AUTH_DATA_PATH=/data/wwebjs-auth
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install the Chrome for Testing build pinned to Puppeteer 24.38.0,
# plus the OS libraries required for that exact browser build.
RUN npx puppeteer browsers install chrome --install-deps \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

COPY src ./src

EXPOSE 3100

CMD ["npm", "start"]
