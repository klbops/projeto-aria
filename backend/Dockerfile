FROM node:20-alpine

RUN apk add --no-cache tini

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN addgroup -S aria && adduser -S aria -G aria
USER aria

EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
