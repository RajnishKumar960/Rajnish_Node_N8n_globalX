# Mock Company API — for local development & demos ONLY. Not a production service.
FROM node:20-alpine

WORKDIR /app

# Install only what the mock server needs.
COPY package.json ./
RUN npm install express@^4.19.2 ts-node@^10.9.2 typescript@^5.5.4 @types/express@^4.17.21 @types/node@^20.14.0

COPY mock-server ./mock-server
COPY tsconfig.json ./

ENV MOCK_PORT=8088
EXPOSE 8088

CMD ["npx", "ts-node", "mock-server/server.ts"]
