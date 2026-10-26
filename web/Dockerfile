FROM oven/bun:1

# Chromium for Puppeteer PDF generation.
# Installing the chromium package pulls in all required shared libs
# (libnss3, libatk, libgbm, etc.) — fixes "libnss3.so: cannot open shared object file".
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Point our launcher (src/app/api/utils/browser.js) straight at the system Chromium.
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# Install deps first (cached unless lockfile changes).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the app.
COPY . .
RUN bun run build

EXPOSE 8080
CMD ["bun", "run", "start"]
