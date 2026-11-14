-- One-time cleanup before restaurant accounts go live.
-- Deletes only FOOD orders. Taxi orders, restaurants, products and users stay.

DELETE FROM "order_items"
WHERE "orderId" IN (SELECT "id" FROM "orders" WHERE "type" = 'FOOD');

DELETE FROM "orders" WHERE "type" = 'FOOD';
