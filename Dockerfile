FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY fantasyIngest.js ./

CMD ["node", "fantasyIngest.js"]
