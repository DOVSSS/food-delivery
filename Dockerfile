FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN npx prisma generate

RUN yarn build

RUN mkdir -p /data/uploads

EXPOSE 3000

CMD ["sh", "-c", "yarn start:prod"]