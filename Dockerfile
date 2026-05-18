FROM node:20-alpine

WORKDIR /app

# Копируем package.json
COPY package*.json ./
COPY yarn.lock ./

# Устанавливаем зависимости
RUN yarn install --frozen-lockfile

# Копируем исходники
COPY . .

# Генерируем Prisma Client
RUN npx prisma generate

# Собираем NestJS
RUN yarn build

# Папка для загрузок
RUN mkdir -p uploads

EXPOSE 3000

CMD ["yarn", "start:prod"]