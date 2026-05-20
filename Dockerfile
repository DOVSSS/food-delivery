FROM node:20-bullseye-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y \
  openssl \
  ca-certificates \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# 👇 важно: schema уже должна существовать
RUN npx prisma generate

RUN yarn build

RUN mkdir -p uploads

EXPOSE 3000

CMD ["yarn", "start:prod"]