FROM node:25-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev

FROM node:25-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g pm2

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

WORKDIR /app/dist

RUN mkdir -p /app/dist/logs
RUN mkdir -p /app/dist/config/certs

EXPOSE 3000

CMD ["pm2-runtime", "start", "index.js", "--name", "musicserver", "--instances", "1"]