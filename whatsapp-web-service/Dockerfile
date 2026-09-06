FROM node:20-bookworm-slim

# Locale and dbus help Chrome for Testing start cleanly in containers.
ENV LANG=en_US.UTF-8
ENV DBUS_SESSION_BUS_ADDRESS=autolaunch:

# Chrome for Testing runtime libraries (Debian Bookworm package names).
# Installed manually because `puppeteer browsers install --install-deps`
# fails apt resolution on bookworm-slim.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    dbus \
    fonts-freefont-ttf \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libvulkan1 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    wget \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV WWEBJS_AUTH_DATA_PATH=/data/wwebjs-auth
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Download Puppeteer 24.38.0's pinned Chrome for Testing build only.
RUN npx puppeteer browsers install chrome

# Pin a known WhatsApp Web HTML build (avoids live-page drift and heavy resync).
ARG WHATSAPP_WEB_VERSION=2.3000.1046816453-alpha
RUN mkdir -p /app/.wwebjs_cache \
  && wget -q -O "/app/.wwebjs_cache/${WHATSAPP_WEB_VERSION}.html" \
    "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${WHATSAPP_WEB_VERSION}.html"

ENV WHATSAPP_WEB_VERSION=${WHATSAPP_WEB_VERSION}
ENV WHATSAPP_WEB_CACHE_PATH=/app/.wwebjs_cache

COPY src ./src

EXPOSE 3100

CMD ["npm", "start"]
