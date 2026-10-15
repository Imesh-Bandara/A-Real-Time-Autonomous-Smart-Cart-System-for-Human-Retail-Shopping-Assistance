from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class ShelfSection(db.Model):
    """
    ShelfSection model storing individual x/y/theta navigation coordinates for each
    of the 5 sections within a physical shelf. The cart navigates to the section-level
    coordinate when picking items from a specific shelf section.
    """
    __tablename__ = 'shelf_sections'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    shelf_id = db.Column(db.String(50), db.ForeignKey('shelves.id', ondelete='CASCADE'), nullable=False)
    section_number = db.Column(db.Integer, nullable=False)  # 1 to 5
    x_coord = db.Column(db.Float, nullable=False, default=0.0)
    y_coord = db.Column(db.Float, nullable=False, default=0.0)
    orientation_theta = db.Column(db.Float, nullable=False, default=0.0)

    __table_args__ = (
        db.UniqueConstraint('shelf_id', 'section_number', name='uq_shelf_section'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'shelf_id': self.shelf_id,
            'section_number': self.section_number,
            'x_coord': self.x_coord,
            'y_coord': self.y_coord,
            'orientation_theta': self.orientation_theta,
        }


class Shelf(db.Model):
    """
    Shelf model representing physical supermarket shelf locations and coordinates.
    Map coordinates (x_coord, y_coord) are in meters from store origin (0, 0).
    orientation_theta is the cart facing orientation in degrees when stopping at the shelf.
    Each shelf has 5 sections (ShelfSection) with their own precise coordinates.
    """
    __tablename__ = 'shelves'

    id = db.Column(db.String(50), primary_key=True)  # e.g., 'SHELF_A', 'SHELF_B', 'SHELF_C'
    name = db.Column(db.String(100), nullable=False)  # e.g., 'Shelf A - Fruits & Vegetables'
    x_coord = db.Column(db.Float, nullable=False)     # Default/base Map X coordinate in meters
    y_coord = db.Column(db.Float, nullable=False)     # Default/base Map Y coordinate in meters
    orientation_theta = db.Column(db.Float, nullable=False, default=0.0)  # Angle in degrees

    products = db.relationship('Product', backref='shelf', lazy=True)
    sections = db.relationship(
        'ShelfSection',
        backref='shelf',
        lazy=True,
        cascade='all, delete-orphan',
        order_by='ShelfSection.section_number',
    )

    def get_section_coords(self, section_number: int) -> dict:
        """Return coordinates for a given section, falling back to base shelf coords."""
        for sec in (self.sections or []):
            if sec.section_number == section_number:
                return {
                    'x': sec.x_coord,
                    'y': sec.y_coord,
                    'orientation_theta': sec.orientation_theta,
                }
        # Fallback: derive offset from base shelf coordinate if section not configured
        offset = (section_number - 1) * 0.3  # 0.3 m apart by default
        return {
            'x': round(self.x_coord + offset, 3),
            'y': self.y_coord,
            'orientation_theta': self.orientation_theta,
        }

    def sections_dict(self) -> list:
        """Return a list of all 5 section coordinate dicts."""
        result = []
        sections_map = {sec.section_number: sec for sec in (self.sections or [])}
        for sec_num in range(1, 6):
            if sec_num in sections_map:
                result.append(sections_map[sec_num].to_dict())
            else:
                offset = (sec_num - 1) * 0.3
                result.append({
                    'id': None,
                    'shelf_id': self.id,
                    'section_number': sec_num,
                    'x_coord': round(self.x_coord + offset, 3),
                    'y_coord': self.y_coord,
                    'orientation_theta': self.orientation_theta,
                })
        return result

    def to_dict(self, include_products=False):
        data = {
            'id': self.id,
            'name': self.name,
            'x_coord': self.x_coord,
            'y_coord': self.y_coord,
            'orientation_theta': self.orientation_theta,
            'product_count': len(self.products) if self.products else 0,
            'sections': self.sections_dict(),
        }
        if include_products:
            data['total_sections'] = 5
            data['products'] = [
                {
                    'id': p.id,
                    'name': p.name,
                    'price': p.price,
                    'stock': p.stock,
                    'shelf_id': p.shelf_id,
                    'shelf_section': p.shelf_section or 1,
                    'image_url': p.image_url or (f'/uploads/products/{p.image_path}' if p.image_path else None),
                }
                for p in (self.products or [])
            ]
        return data


class Product(db.Model):
    """
    Product model representing supermarket inventory items linked to a physical shelf.
    shelf_section specifies which section of the shelf (1 to 5) the item is placed on.
    """
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    shelf_id = db.Column(db.String(50), db.ForeignKey('shelves.id'), nullable=True)
    shelf_section = db.Column(db.Integer, nullable=True, default=1)  # Section 1, 2, 3, 4, 5
    image_url = db.Column(db.String(255), nullable=True)

    # Optional metadata fields for catalog management
    stock = db.Column(db.Integer, nullable=False, default=50)
    description = db.Column(db.Text, nullable=True)
    image_path = db.Column(db.String(255), nullable=True)

    def to_dict(self, include_shelf=True):
        data = {
            'id': self.id,
            'name': self.name,
            'price': self.price,
            'shelf_id': self.shelf_id,
            'shelf_section': self.shelf_section or 1,
            'image_url': self.image_url or (f'/uploads/products/{self.image_path}' if self.image_path else None),
            'stock': self.stock,
            'description': self.description,
        }
        if include_shelf and self.shelf:
            data['shelf'] = {
                'id': self.shelf.id,
                'name': self.shelf.name,
                'x_coord': self.shelf.x_coord,
                'y_coord': self.shelf.y_coord,
                'orientation_theta': self.shelf.orientation_theta,
            }
        else:
            data['shelf'] = None
        return data


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='customer')
    orders = db.relationship('Order', backref='user', lazy=True)


class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    status = db.Column(db.String(20), nullable=False, default='submitted')
    total_amount = db.Column(db.Float, nullable=False, default=0.0)
    cart_id = db.Column(db.String(50), nullable=False, default='CART_01')
    mqtt_status = db.Column(db.String(20), nullable=False, default='pending')
    mqtt_message_id = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    submitted_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, include_items=False):
        data = {
            'id': self.id,
            'order_code': f"ORD_{self.id:04d}",
            'user_id': self.user_id,
            'cart_id': self.cart_id,
            'status': self.status,
            'total_amount': self.total_amount,
            'mqtt_status': self.mqtt_status,
            'mqtt_message_id': self.mqtt_message_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'item_count': len(self.items) if self.items else 0,
        }
        if include_items and self.items:
            data['items'] = [item.to_dict() for item in self.items]
        return data


class OrderItem(db.Model):
    __tablename__ = 'order_items'
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    unit_price = db.Column(db.Float, nullable=False)
    subtotal = db.Column(db.Float, nullable=False)

    product = db.relationship('Product', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else 'Unknown',
            'shelf_id': self.product.shelf_id if self.product else None,
            'quantity': self.quantity,
            'unit_price': self.unit_price,
            'subtotal': self.subtotal,
        }
