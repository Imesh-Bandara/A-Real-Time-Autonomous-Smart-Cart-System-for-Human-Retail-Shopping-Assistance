"""
init_db.py — Database Initialization and Seeder for CartMate

Creates PostgreSQL schema/tables and seeds initial shelves and products:
- Shelves: SHELF_A (1.5, 2.0), SHELF_B (3.8, 1.2), SHELF_C (5.2, 4.1)
- Products: Apple, Milk, Soap, etc. linked to their physical shelves.
"""

import os
import uuid
import shutil
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


# Prototype objects recognised by the Raspberry Pi YOLO model (matched by exact name).
PROTOTYPE_PRODUCTS = [
    {"name": "Cube", "price": 2.50, "stock": 10, "shelf_id": "SHELF_A", "shelf_section": 1,
     "description": "Prototype object P001, foam cube, 100 g", "photo": "cube.jpg"},
    {"name": "Tall Box", "price": 3.50, "stock": 10, "shelf_id": "SHELF_A", "shelf_section": 2,
     "description": "Prototype object P002, tall box, 200 g", "photo": "tall_box.jpg"},
    {"name": "Cylinder", "price": 3.00, "stock": 10, "shelf_id": "SHELF_A", "shelf_section": 3,
     "description": "Prototype object P003, cylinder, 150 g", "photo": "cylinder.jpg"},
    {"name": "Triangle Prism", "price": 2.00, "stock": 10, "shelf_id": "SHELF_A", "shelf_section": 4,
     "description": "Prototype object P004, triangle prism, 50 g", "photo": "triangle_prism.jpg"},
]

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PHOTO_SOURCE_DIR = os.path.join(BACKEND_DIR, 'product_photos')
UPLOAD_DIR = os.path.join(BACKEND_DIR, 'uploads', 'products')
MAX_IMAGE_WIDTH = 800
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _import_prototype_photo(product, photo_name):
    """Copy a photo into uploads/products/ (same naming as save_product_image), resizing if too large."""
    src = os.path.join(PHOTO_SOURCE_DIR, photo_name)
    if not os.path.isfile(src):
        logger.warning(f"[CartMate DB] Photo missing for '{product.name}': {src} (product created without image)")
        return
    ext = photo_name.rsplit('.', 1)[1].lower()
    filename = f"{product.id}_{uuid.uuid4().hex[:8]}.{ext}"
    dest = os.path.join(UPLOAD_DIR, filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    from PIL import Image, ImageOps
    with Image.open(src) as img:
        img = ImageOps.exif_transpose(img)
        if img.width > MAX_IMAGE_WIDTH or os.path.getsize(src) > MAX_IMAGE_BYTES:
            img.thumbnail((MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH * 10))
            if ext in ('jpg', 'jpeg'):
                img.convert('RGB').save(dest, quality=85, optimize=True)
            else:
                img.save(dest)
        else:
            shutil.copyfile(src, dest)
    product.image_path = filename


def _seed_prototype_products():
    """Get-or-create the prototype products by name; attach a photo only if image_path is empty."""
    for data in PROTOTYPE_PRODUCTS:
        product = Product.query.filter_by(name=data["name"]).first()
        if not product:
            product = Product(**{k: v for k, v in data.items() if k != "photo"})
            db.session.add(product)
            db.session.flush()  # assign product.id for the image filename
        if not product.image_path:
            _import_prototype_photo(product, data["photo"])
    db.session.commit()


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


# Columns added after the first release. db.create_all() does not alter existing tables,
# so each missing column is added with ALTER TABLE ... ADD COLUMN (works on SQLite and PostgreSQL).
# Values: (SQLite type, PostgreSQL type)
ADDED_COLUMNS = {
    'users': {
        'name': ('VARCHAR(120)', 'VARCHAR(120)'),
    },
    'orders': {
        'session_code': ('VARCHAR(40)', 'VARCHAR(40)'),
        'payment_status': ("VARCHAR(20) DEFAULT 'unpaid'", "VARCHAR(20) DEFAULT 'unpaid'"),
        'paid_at': ('DATETIME', 'TIMESTAMP'),
        'pickup_eta': ('DATETIME', 'TIMESTAMP'),
        'otp_encrypted': ('TEXT', 'TEXT'),
        'otp_expires_at': ('DATETIME', 'TIMESTAMP'),
        'otp_attempts': ('INTEGER DEFAULT 0', 'INTEGER DEFAULT 0'),
        'otp_locked': ('BOOLEAN DEFAULT 0', 'BOOLEAN DEFAULT FALSE'),
        'completed_at': ('DATETIME', 'TIMESTAMP'),
        'shopping_state': ("VARCHAR(20) DEFAULT 'waiting'", "VARCHAR(20) DEFAULT 'waiting'"),
        'picked_up_at': ('DATETIME', 'TIMESTAMP'),
    },
}


def migrate_added_columns():
    """Add any missing columns from ADDED_COLUMNS. Safe to run on every start."""
    inspector = db.inspect(db.engine)
    is_postgres = db.engine.dialect.name == 'postgresql'
    for table, columns in ADDED_COLUMNS.items():
        if not inspector.has_table(table):
            continue  # create_all() just built it with every column
        existing = {col['name'] for col in inspector.get_columns(table)}
        for column, (sqlite_type, pg_type) in columns.items():
            if column in existing:
                continue
            ddl = f'ALTER TABLE {table} ADD COLUMN {column} {pg_type if is_postgres else sqlite_type}'
            try:
                with db.engine.begin() as conn:
                    conn.execute(db.text(ddl))
                logger.info(f"[CartMate DB] Migration: added {table}.{column}")
            except Exception as e:
                logger.error(f"[CartMate DB] Migration failed for {table}.{column}: {e}")


def seed_database(app):
    """Seed initial shelves, products, and default users."""
    with app.app_context():
        db.create_all()
        migrate_added_columns()

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

        _seed_prototype_products()
        logger.info("[CartMate DB] Successfully initialized and seeded database with shelves and products.")


if __name__ == '__main__':
    from app import app
    seed_database(app)
    print("Database seeding completed.")
