"""
init_db.py — Database Initialization and Seeder for CartMate

Creates PostgreSQL schema/tables and seeds initial shelves and products:
- Shelves: SHELF_A (1.5, 2.0), SHELF_B (3.8, 1.2), SHELF_C (5.2, 4.1)
- Products: Apple, Milk, Soap, etc. linked to their physical shelves.
"""

import os
import logging
from models import db, Shelf, ShelfSection, Product, User

logger = logging.getLogger(__name__)

INITIAL_SHELVES = [
    {
        "id": "SHELF_A",
        "name": "Shelf A - Fruits & Vegetables",
        "x_coord": 1.5,
        "y_coord": 2.0,
        "orientation_theta": 0.0,
    },
    {
        "id": "SHELF_B",
        "name": "Shelf B - Dairy & Bakery",
        "x_coord": 3.8,
        "y_coord": 1.2,
        "orientation_theta": 90.0,
    },
    {
        "id": "SHELF_C",
        "name": "Shelf C - Personal Care & Household",
        "x_coord": 5.2,
        "y_coord": 4.1,
        "orientation_theta": 180.0,
    },
]

INITIAL_PRODUCTS = [
    {
        "id": 1,
        "name": "Apple",
        "price": 1.99,
        "shelf_id": "SHELF_A",
        "shelf_section": 1,
        "stock": 50,
        "description": "Crisp and juicy organic red apples sourced locally.",
        "image_url": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600",
    },
    {
        "id": 2,
        "name": "Milk",
        "price": 3.49,
        "shelf_id": "SHELF_B",
        "shelf_section": 1,
        "stock": 35,
        "description": "Fresh whole pasteurized milk rich in calcium.",
        "image_url": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600",
    },
    {
        "id": 3,
        "name": "Soap",
        "price": 4.99,
        "shelf_id": "SHELF_C",
        "shelf_section": 1,
        "stock": 40,
        "description": "Gentle moisturizing botanical soap bar.",
        "image_url": "https://images.unsplash.com/photo-1607006314181-b582845c4fc3?w=600",
    },
    {
        "id": 4,
        "name": "Banana",
        "price": 0.99,
        "shelf_id": "SHELF_A",
        "shelf_section": 2,
        "stock": 60,
        "description": "Sweet ripe tropical Cavendish bananas.",
        "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600",
    },
    {
        "id": 5,
        "name": "Bread",
        "price": 2.49,
        "shelf_id": "SHELF_B",
        "shelf_section": 2,
        "stock": 25,
        "description": "Artisan baked whole grain sandwich loaf.",
        "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600",
    },
    {
        "id": 6,
        "name": "Shampoo",
        "price": 6.99,
        "shelf_id": "SHELF_C",
        "shelf_section": 2,
        "stock": 30,
        "description": "Nourishing daily cleansing shampoo with natural oils.",
        "image_url": "https://images.unsplash.com/photo-1585232351009-aa87416fca90?w=600",
    },
]


def _seed_shelf_sections(shelf_id: str, base_x: float, base_y: float, theta: float):
    """Seed 5 ShelfSection rows for a shelf if they don't already exist."""
    for sec_num in range(1, 6):
        existing = ShelfSection.query.filter_by(shelf_id=shelf_id, section_number=sec_num).first()
        if not existing:
            offset = round((sec_num - 1) * 0.3, 3)
            db.session.add(ShelfSection(
                shelf_id=shelf_id,
                section_number=sec_num,
                x_coord=round(base_x + offset, 3),
                y_coord=base_y,
                orientation_theta=theta,
            ))


def seed_database(app):
    """Seed initial shelves, products, and default users."""
    with app.app_context():
        db.create_all()

        # Ensure column shelf_section exists (SQLite & Postgres safety)
        try:
            with db.engine.connect() as conn:
                conn.execute(db.text("ALTER TABLE products ADD COLUMN shelf_section INTEGER DEFAULT 1"))
                conn.commit()
        except Exception:
            pass  # Column already exists

        # Seed Shelves
        for shelf_data in INITIAL_SHELVES:
            existing_shelf = Shelf.query.get(shelf_data["id"])
            if not existing_shelf:
                new_shelf = Shelf(
                    id=shelf_data["id"],
                    name=shelf_data["name"],
                    x_coord=shelf_data["x_coord"],
                    y_coord=shelf_data["y_coord"],
                    orientation_theta=shelf_data["orientation_theta"],
                )
                db.session.add(new_shelf)
            else:
                existing_shelf.name = shelf_data["name"]
                existing_shelf.x_coord = shelf_data["x_coord"]
                existing_shelf.y_coord = shelf_data["y_coord"]
                existing_shelf.orientation_theta = shelf_data["orientation_theta"]

        db.session.commit()

        # Seed ShelfSection coordinates (5 per shelf)
        for shelf_data in INITIAL_SHELVES:
            _seed_shelf_sections(
                shelf_id=shelf_data["id"],
                base_x=shelf_data["x_coord"],
                base_y=shelf_data["y_coord"],
                theta=shelf_data["orientation_theta"],
            )
        db.session.commit()

        # Seed Products
        for prod_data in INITIAL_PRODUCTS:
            existing_product = Product.query.get(prod_data["id"])
            if not existing_product:
                new_prod = Product(
                    id=prod_data["id"],
                    name=prod_data["name"],
                    price=prod_data["price"],
                    shelf_id=prod_data["shelf_id"],
                    shelf_section=prod_data.get("shelf_section", 1),
                    stock=prod_data["stock"],
                    description=prod_data["description"],
                    image_url=prod_data["image_url"],
                )
                db.session.add(new_prod)
            else:
                existing_product.shelf_id = prod_data["shelf_id"]
                if not existing_product.shelf_section:
                    existing_product.shelf_section = prod_data.get("shelf_section", 1)
                if not existing_product.image_url:
                    existing_product.image_url = prod_data["image_url"]

        # Seed default users
        if not User.query.filter_by(email="admin@test.com").first():
            admin = User(email="admin@test.com", password="admin123", role="admin")
            customer = User(email="user@test.com", password="user123", role="customer")
            db.session.add_all([admin, customer])

        db.session.commit()
        logger.info("[CartMate DB] Successfully initialized and seeded database with shelves and products.")


if __name__ == '__main__':
    from app import app
    seed_database(app)
    print("Database seeding completed.")
