FROM node:25-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev

FROM node:25-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g pm2

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

WORKDIR /app/dist

RUN mkdir -p /app/dist/logs

EXPOSE 3000

CMD ["pm2-runtime", "start", "index.js", "--name", "musicserver", "--instances", "1"]