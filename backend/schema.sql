-- CartMate PostgreSQL Schema
-- Database: cartmate

-- Drop tables if needed
-- DROP TABLE IF EXISTS order_items;
-- DROP TABLE IF EXISTS orders;
-- DROP TABLE IF EXISTS products;
-- DROP TABLE IF EXISTS shelves;
-- DROP TABLE IF EXISTS users;

-- 1. Shelves Table
CREATE TABLE IF NOT EXISTS shelves (
    id VARCHAR(50) PRIMARY KEY,                   -- e.g., 'SHELF_A', 'SHELF_B', 'SHELF_C'
    name VARCHAR(100) NOT NULL,                   -- e.g., 'Shelf A - Fruits & Vegetables'
    x_coord DOUBLE PRECISION NOT NULL,            -- Map X coordinate in meters
    y_coord DOUBLE PRECISION NOT NULL,            -- Map Y coordinate in meters
    orientation_theta DOUBLE PRECISION DEFAULT 0.0 -- Heading orientation angle in degrees
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,                   -- e.g., 'Apple', 'Milk', 'Soap'
    price DOUBLE PRECISION NOT NULL,
    shelf_id VARCHAR(50) REFERENCES shelves(id) ON DELETE SET NULL,
    image_url VARCHAR(255),
    stock INTEGER DEFAULT 50,
    description TEXT,
    image_path VARCHAR(255)
);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(120) UNIQUE NOT NULL,
    password VARCHAR(120) NOT NULL,
    role VARCHAR(20) DEFAULT 'customer'
);

-- 4. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    cart_id VARCHAR(50) DEFAULT 'CART_01',
    status VARCHAR(20) DEFAULT 'sent_to_cart',
    total_amount DOUBLE PRECISION DEFAULT 0.0,
    mqtt_status VARCHAR(20) DEFAULT 'pending',
    mqtt_message_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    unit_price DOUBLE PRECISION NOT NULL,
    subtotal DOUBLE PRECISION NOT NULL
);

-- Initial Shelves Seed Data
INSERT INTO shelves (id, name, x_coord, y_coord, orientation_theta)
VALUES 
    ('SHELF_A', 'Shelf A - Fruits & Vegetables', 1.5, 2.0, 0.0),
    ('SHELF_B', 'Shelf B - Dairy & Bakery', 3.8, 1.2, 90.0),
    ('SHELF_C', 'Shelf C - Personal Care & Household', 5.2, 4.1, 180.0)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    x_coord = EXCLUDED.x_coord,
    y_coord = EXCLUDED.y_coord,
    orientation_theta = EXCLUDED.orientation_theta;

-- Initial Products Seed Data
INSERT INTO products (id, name, price, shelf_id, image_url, stock, description)
VALUES
    (1, 'Apple', 1.99, 'SHELF_A', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600', 50, 'Crisp and juicy organic red apples sourced locally.'),
    (2, 'Milk', 3.49, 'SHELF_B', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600', 35, 'Fresh whole pasteurized milk rich in calcium.'),
    (3, 'Soap', 4.99, 'SHELF_C', 'https://images.unsplash.com/photo-1607006314181-b582845c4fc3?w=600', 40, 'Gentle moisturizing botanical soap bar.'),
    (4, 'Banana', 0.99, 'SHELF_A', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600', 60, 'Sweet ripe tropical Cavendish bananas.'),
    (5, 'Bread', 2.49, 'SHELF_B', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600', 25, 'Artisan baked whole grain sandwich loaf.'),
    (6, 'Shampoo', 6.99, 'SHELF_C', 'https://images.unsplash.com/photo-1585232351009-aa87416fca90?w=600', 30, 'Nourishing daily cleansing shampoo with natural oils.')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    shelf_id = EXCLUDED.shelf_id,
    image_url = EXCLUDED.image_url;
