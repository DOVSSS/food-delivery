FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY yarn.lock ./

RUN yarn install --frozen-lockfile

# Copy schema first so prisma generate always matches the committed schema
COPY prisma ./prisma

RUN npx prisma generate --schema=./prisma/schema.prisma \
    && grep -q openTime node_modules/.prisma/client/index.d.ts

COPY . .

RUN npx prisma generate --schema=./prisma/schema.prisma \
    && grep -q openTime node_modules/.prisma/client/index.d.ts \
    && yarn build

RUN mkdir -p /data/uploads

RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
