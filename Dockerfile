# Node.js 22.23.4 contains the fix for CVE-2026-111497 (Brotli decoder)
FROM node:22.23.4-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .
# the app writes restrictedaccess.log into /app
RUN chown node:node /app

USER node

EXPOSE 4000
CMD ["node", "src/serverEmailAutomat.js"]
