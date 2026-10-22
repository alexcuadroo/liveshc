# Node.js 22.23.4: security release 2026-10-21 (CVE-2026-111497, HIGH).
ARG NODE_VERSION=22.23.4
FROM node:${NODE_VERSION}-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY migrations ./migrations
COPY src ./src
COPY public ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npm run migrate && npm start"]
