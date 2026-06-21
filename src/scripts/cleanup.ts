import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Удаляю OrderItem...');
  const items = await prisma.orderItem.deleteMany({});
  console.log(`Удалено OrderItem: ${items.count}`);

  console.log('Удаляю Order...');
  const orders = await prisma.order.deleteMany({});
  console.log(`Удалено Order: ${orders.count}`);

  console.log('Удаляю Product...');
  const products = await prisma.product.deleteMany({});
  console.log(`Удалено Product: ${products.count}`);

  console.log('Удаляю Restaurant...');
  const restaurants = await prisma.restaurant.deleteMany({});
  console.log(`Удалено Restaurant: ${restaurants.count}`);

  console.log('Готово!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });