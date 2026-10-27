# Imagem de produção da RCV Estúdio Rádio
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build && npm test

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 TZ=America/Sao_Paulo
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY package.json ./
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 8080
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "dist-server/index.js"]
