FROM oven/bun:1-alpine

WORKDIR /app

COPY ws-server.ts ./

ENV PORT=3001

EXPOSE 3001

CMD ["bun", "run", "ws-server.ts"]
