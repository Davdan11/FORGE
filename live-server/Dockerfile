# FORGE live server: any host that runs a container (Fly.io, Railway, Render, a VPS).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server.mjs"]
