FROM node:20-bullseye-slim

WORKDIR /app

# системные зависимости (нужны Prisma + bcrypt + openssl)
RUN apt-get update -y && apt-get install -y \
  openssl \
  ca-certificates \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

# копируем зависимости
COPY package.json yarn.lock ./

# ставим зависимости
RUN yarn install --frozen-lockfile

# копируем код
COPY . .

# генерим prisma client (ОБЯЗАТЕЛЬНО)
RUN npx prisma generate

# билд nestjs
RUN yarn build

# папка под upload (у тебя используется static assets)
RUN mkdir -p uploads

EXPOSE 3000

# ❗ ВАЖНО: БЕЗ migrate deploy в startup
CMD ["yarn", "start:prod"]