-- Remaining test orders (including taxi) so admin dashboard
-- shows 0 orders and 0 revenue. Users, restaurants and products stay.

DELETE FROM "order_items";
DELETE FROM "orders";
