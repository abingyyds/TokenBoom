FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV SITE_SAAS_STORE=/data/site-saas-store.json

CMD ["npm", "start"]
