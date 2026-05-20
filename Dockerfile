FROM node:20-bullseye-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates python3 make g++

COPY package*.json ./
COPY yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN npx prisma generate

RUN yarn build

RUN mkdir -p uploads

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && yarn start:prod"]