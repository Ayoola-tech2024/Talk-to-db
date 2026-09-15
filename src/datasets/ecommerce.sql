-- E-Commerce & Solar Marketplace Database
CREATE TABLE IF NOT EXISTS categories (
  category_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS products (
  product_id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  brand TEXT NOT NULL,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE IF NOT EXISTS customers (
  customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  city TEXT NOT NULL,
  total_spent INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  order_id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  order_date TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE IF NOT EXISTS order_items (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  review_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(product_id),
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- Seed Data: Categories
INSERT INTO categories (name, slug, description) VALUES
  ('Hybrid Inverters', 'hybrid-inverters', 'Smart solar inverters with grid & battery integration'),
  ('Lithium LiFePO4 Batteries', 'lithium-batteries', 'High cycle life energy storage batteries'),
  ('Monocrystalline Solar Panels', 'solar-panels', 'High efficiency Tier-1 PV modules'),
  ('Solar Charge Controllers', 'charge-controllers', 'MPPT solar charge controllers');

-- Seed Data: Products
INSERT INTO products (title, brand, price, stock, category_id, created_at) VALUES
  ('Deye 5kW Hybrid Inverter (SUN-5K-SG03LP1)', 'Deye', 1850000, 14, 1, '2026-01-10'),
  ('SRNE 10kW Three-Phase Hybrid Inverter', 'SRNE', 3400000, 6, 1, '2026-01-15'),
  ('Felicity 5.12kWh LiFePO4 Battery (LPBA48100)', 'Felicity', 1650000, 20, 2, '2026-02-01'),
  ('Pylontech 4.8kWh US3000C Lithium Battery', 'Pylontech', 1950000, 8, 2, '2026-02-05'),
  ('Jinko 585W N-Type Bifacial Solar Panel', 'Jinko', 145000, 120, 3, '2026-02-12'),
  ('Longi 550W Hi-MO 5 Monocrystalline Panel', 'Longi', 135000, 85, 3, '2026-02-20'),
  ('Victron SmartSolar MPPT 150/70-Tr', 'Victron Energy', 620000, 12, 4, '2026-03-01'),
  ('Outback FM80 MPPT Charge Controller', 'Outback', 780000, 0, 4, '2026-03-05');

-- Seed Data: Customers
INSERT INTO customers (name, email, phone, city, total_spent) VALUES
  ('Ayoola Damisile', 'ayoola@lightsupenergy.com', '+2347036791927', 'Lagos', 5450000),
  ('Dr. Babatunde Fashola', 'b.fashola@estate.ng', '+2348031234567', 'Abuja', 3500000),
  ('Chief Emeka Okoli', 'emeka.okoli@enugu.gov.ng', '+2348099887766', 'Enugu', 1650000),
  ('Amina Garba', 'amina.garba@kano.biz', '+2348123456789', 'Kano', 0),
  ('Engr. Victor Adeleke', 'victor.a@ibadan.org', '+2347012345678', 'Ibadan', 145000);

-- Seed Data: Orders
INSERT INTO orders (customer_id, order_date, total_amount, status, payment_method) VALUES
  (1, '2026-03-01', 3500000, 'Delivered', 'Paystack Transfer'),
  (1, '2026-03-10', 1950000, 'Delivered', 'Paystack Card'),
  (2, '2026-03-05', 3500000, 'Shipped', 'Bank Transfer'),
  (3, '2026-03-12', 1650000, 'Processing', 'Paystack Card'),
  (5, '2026-03-14', 145000, 'Delivered', 'Paystack Card');

-- Seed Data: Order Items
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  (1, 1, 1, 1850000),
  (1, 3, 1, 1650000),
  (2, 4, 1, 1950000),
  (3, 2, 1, 3400000),
  (4, 3, 1, 1650000),
  (5, 5, 1, 145000);

-- Seed Data: Reviews
INSERT INTO reviews (product_id, customer_id, rating, comment, created_at) VALUES
  (1, 1, 5, 'Super silent and delivers true 5kW continuous power. Connects flawlessly with SolarGPT bot.', '2026-03-04'),
  (3, 1, 5, 'Zero drop in voltage during high AC inductive surge. Excellent build quality.', '2026-03-05'),
  (4, 1, 5, 'Pylontech BMS communication with Deye inverter is instantaneous.', '2026-03-11'),
  (5, 5, 4, 'Very high output even on overcast rainy mornings in Ibadan.', '2026-03-15');
