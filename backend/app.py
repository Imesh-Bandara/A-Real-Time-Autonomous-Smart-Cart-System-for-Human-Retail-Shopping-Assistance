import os
import uuid
import json
import logging
from datetime import datetime, timezone, timedelta
from flask import Flask, jsonify, request, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, get_jwt
)
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///supermarket.db'
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'super-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=12)  # short-lived by default; long enough for dev sessions
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5 MB max upload

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads', 'products')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

db = SQLAlchemy(app)
CORS(app)
jwt = JWTManager(app)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def product_to_dict(product):
    data = {
        'id': product.id,
        'name': product.name,
        'price': product.price,
        'stock': product.stock,
        'description': product.description,
        'image_url': None,
    }
    if product.image_path:
        data['image_url'] = f'/uploads/products/{product.image_path}'
    return data


def save_product_image(file, product_id):
    if not file or not file.filename or not allowed_file(file.filename):
        return None
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{product_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    return filename


def delete_product_image(image_path):
    if not image_path:
        return
    filepath = os.path.join(UPLOAD_FOLDER, image_path)
    if os.path.exists(filepath):
        os.remove(filepath)


# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    name = db.Column(db.String(120), nullable=True)
    orders = db.relationship('Order', backref='user', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'role': self.role,
        }


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, nullable=False)
    image_path = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)


class Order(db.Model):
    """
    Lifecycle statuses:
      draft → submitted → sent_to_cart → acknowledged → picking
      → verifying → ready → completed | cancelled | failed
    MQTT statuses:
      not_sent → pending → published → acknowledged | failed
    """
    __tablename__ = 'order'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='draft')
    total_amount = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    submitted_at = db.Column(db.DateTime, nullable=True)
    mqtt_status = db.Column(db.String(20), nullable=False, default='not_sent')
    mqtt_message_id = db.Column(db.String(100), nullable=True)
    items = db.relationship('OrderItem', backref='order', lazy=True,
                            cascade='all, delete-orphan')

    def to_dict(self, include_items=False):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'status': self.status,
            'total_amount': self.total_amount,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'mqtt_status': self.mqtt_status,
            'mqtt_message_id': self.mqtt_message_id,
            'item_count': len(self.items),
        }
        if include_items:
            data['items'] = [item.to_dict() for item in self.items]
        return data


class OrderItem(db.Model):
    __tablename__ = 'order_item'
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)  # Price locked at order time
    subtotal = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    product = db.relationship('Product', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else 'Unknown',
            'product_image_url': (
                f'/uploads/products/{self.product.image_path}'
                if self.product and self.product.image_path else None
            ),
            'quantity': self.quantity,
            'unit_price': self.unit_price,
            'subtotal': self.subtotal,
        }


# ---------------------------------------------------------------------------
# DB Migration — non-destructive, adds missing columns/tables
# ---------------------------------------------------------------------------

def migrate_db():
    inspector = db.inspect(db.engine)
    existing_tables = inspector.get_table_names()

    # Add missing columns to 'product' table
    if 'product' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('product')]
        product_migrations = {
            'image_path': 'ALTER TABLE product ADD COLUMN image_path VARCHAR(255)',
            'description': 'ALTER TABLE product ADD COLUMN description TEXT',
        }
        for column, sql in product_migrations.items():
            if column not in columns:
                with db.engine.connect() as conn:
                    conn.execute(db.text(sql))
                    conn.commit()

    # Add missing columns to 'order' table if it already exists
    if '"order"' in existing_tables or 'order' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('order')]
        order_migrations = {
            'mqtt_status': 'ALTER TABLE "order" ADD COLUMN mqtt_status VARCHAR(20) DEFAULT \'not_sent\'',
            'mqtt_message_id': 'ALTER TABLE "order" ADD COLUMN mqtt_message_id VARCHAR(100)',
            'submitted_at': 'ALTER TABLE "order" ADD COLUMN submitted_at DATETIME',
        }
        for column, sql in order_migrations.items():
            if column not in columns:
                with db.engine.connect() as conn:
                    conn.execute(db.text(sql))
                    conn.commit()

    # Add missing columns to 'user' table
    if 'user' in existing_tables:
        columns = [col['name'] for col in inspector.get_columns('user')]
        user_migrations = {
            'name': 'ALTER TABLE user ADD COLUMN name VARCHAR(120)',
        }
        for column, sql in user_migrations.items():
            if column not in columns:
                with db.engine.connect() as conn:
                    conn.execute(db.text(sql))
                    conn.commit()


with app.app_context():
    db.create_all()
    migrate_db()
    if not User.query.filter_by(email="admin@test.com").first():
        admin = User(email="admin@test.com", password="admin123", role="admin", name="Admin User")
        customer = User(email="user@test.com", password="user123", role="customer", name="Alex Customer")
        item1 = Product(name="Fresh Apples", price=2.99, stock=50)
        item2 = Product(name="Organic Milk", price=3.49, stock=30)
        db.session.add_all([admin, customer, item1, item2])
        db.session.commit()
    else:
        for u, default_name in (('admin@test.com', 'Admin User'), ('user@test.com', 'Alex Customer')):
            existing = User.query.filter_by(email=u).first()
            if existing and not existing.name:
                existing.name = default_name
        db.session.commit()


# ---------------------------------------------------------------------------
# Helper: import mqtt_service lazily (so missing paho-mqtt doesn't crash app)
# ---------------------------------------------------------------------------

def get_mqtt_service():
    try:
        from mqtt_service import publish_order
        return publish_order
    except ImportError:
        logger.error("[MQTT] mqtt_service.py not found or paho-mqtt not installed.")
        return None


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "Success", "message": "Smart Cart API is running!"})


@app.route('/uploads/products/<path:filename>', methods=['GET'])
def serve_product_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    user = User.query.filter_by(email=email, password=password).first()
    if not user:
        return jsonify({"msg": "Invalid credentials"}), 401
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "email": user.email}
    )
    return jsonify(
        access_token=access_token, role=user.role, email=user.email, name=user.name
    ), 200


@app.route('/api/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({"msg": "User not found"}), 404
    return jsonify(user.to_dict()), 200


@app.route('/api/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({"msg": "User not found"}), 404

    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if name is not None:
        user.name = name.strip() or None

    if email is not None and email.strip() and email.strip() != user.email:
        email = email.strip()
        if User.query.filter(User.email == email, User.id != user.id).first():
            return jsonify({"msg": "Email is already in use"}), 409
        user.email = email

    if new_password:
        if user.password != current_password:
            return jsonify({"msg": "Current password is incorrect"}), 401
        if len(new_password) < 6:
            return jsonify({"msg": "New password must be at least 6 characters"}), 400
        user.password = new_password

    db.session.commit()

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "email": user.email}
    )
    return jsonify(user=user.to_dict(), access_token=access_token), 200


# ---------------------------------------------------------------------------
# Product routes
# ---------------------------------------------------------------------------

@app.route('/api/products', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify([product_to_dict(p) for p in products]), 200


@app.route('/api/products', methods=['POST'])
def add_product():
    is_multipart = request.content_type and 'multipart/form-data' in request.content_type
    if is_multipart:
        name = request.form.get('name')
        price = request.form.get('price')
        stock = request.form.get('stock')
        description = request.form.get('description')
        image_file = request.files.get('image')
    else:
        data = request.get_json() or {}
        name = data.get('name')
        price = data.get('price')
        stock = data.get('stock')
        description = data.get('description')
        image_file = None

    if not name or price is None or stock is None:
        return jsonify({"msg": "Missing required fields (name, price, stock)"}), 400

    try:
        new_product = Product(
            name=name,
            price=float(price),
            stock=int(stock),
            description=description.strip() if description else None,
        )
        db.session.add(new_product)
        db.session.flush()
        if image_file:
            saved_filename = save_product_image(image_file, new_product.id)
            if saved_filename:
                new_product.image_path = saved_filename
        db.session.commit()
        return jsonify({"msg": "Product added successfully!", "product": product_to_dict(new_product)}), 201
    except (ValueError, TypeError):
        db.session.rollback()
        return jsonify({"msg": "Invalid price or stock value"}), 400
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Failed to add product"}), 500


@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    product = Product.query.get(product_id)
    if not product:
        return jsonify({"msg": "Product not found"}), 404
    delete_product_image(product.image_path)
    db.session.delete(product)
    db.session.commit()
    return jsonify({"msg": "Product deleted successfully!"}), 200


# ---------------------------------------------------------------------------
# Order routes — all require JWT authentication
# ---------------------------------------------------------------------------

@app.route('/api/orders', methods=['POST'])
@jwt_required()
def create_order():
    """
    Create a draft order with items.
    Body: { items: [{ product_id, quantity }] }
    The backend re-fetches prices and calculates totals — never trust the frontend.
    """
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    items_data = data.get('items', [])

    if not items_data:
        return jsonify({"msg": "Order must contain at least one item"}), 400

    try:
        order = Order(user_id=user_id, status='draft')
        db.session.add(order)
        db.session.flush()  # Get order.id

        total = 0.0
        for item_data in items_data:
            product_id = item_data.get('product_id')
            quantity = item_data.get('quantity', 0)

            if not product_id or quantity <= 0:
                db.session.rollback()
                return jsonify({"msg": "Invalid product_id or quantity"}), 400

            product = Product.query.get(product_id)
            if not product:
                db.session.rollback()
                return jsonify({"msg": f"Product ID {product_id} not found"}), 404
            if product.stock < quantity:
                db.session.rollback()
                return jsonify({
                    "msg": f"Only {product.stock} units of '{product.name}' are available"
                }), 409

            unit_price = product.price
            subtotal = round(unit_price * quantity, 2)
            total += subtotal

            order_item = OrderItem(
                order_id=order.id,
                product_id=product_id,
                quantity=quantity,
                unit_price=unit_price,
                subtotal=subtotal,
            )
            db.session.add(order_item)

        order.total_amount = round(total, 2)
        db.session.commit()
        return jsonify({"msg": "Order created", "order": order.to_dict(include_items=True)}), 201

    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to create order")
        return jsonify({"msg": "Failed to create order"}), 500


@app.route('/api/orders', methods=['GET'])
@jwt_required()
def get_orders():
    """List authenticated user's orders, newest first."""
    user_id = int(get_jwt_identity())
    orders = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc()).all()
    return jsonify([o.to_dict(include_items=True) for o in orders]), 200


@app.route('/api/orders/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    """Get a single order with items. Users can only see their own orders."""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"msg": "Order not found"}), 404
    if order.user_id != user_id and claims.get('role') != 'admin':
        return jsonify({"msg": "Access denied"}), 403
    return jsonify(order.to_dict(include_items=True)), 200


@app.route('/api/orders/<int:order_id>/submit', methods=['POST'])
@jwt_required()
def submit_order(order_id):
    """
    Submit a draft order:
    1. Re-validate all stock
    2. Mark order as submitted
    3. Publish MQTT message via mqtt_service
    4. Update mqtt_status
    5. Return result — distinguishes order failure from MQTT failure
    """
    user_id = int(get_jwt_identity())
    order = Order.query.get(order_id)

    if not order:
        return jsonify({"msg": "Order not found"}), 404
    if order.user_id != user_id:
        return jsonify({"msg": "Access denied"}), 403
    if order.status != 'draft':
        return jsonify({"msg": f"Order cannot be submitted in status '{order.status}'"}), 409
    if not order.items:
        return jsonify({"msg": "Order has no items"}), 400

    # Re-validate stock for all items before committing
    for item in order.items:
        product = Product.query.get(item.product_id)
        if not product:
            return jsonify({"msg": f"Product ID {item.product_id} no longer exists"}), 409
        if product.stock < item.quantity:
            return jsonify({
                "msg": f"Only {product.stock} units of '{product.name}' are currently available"
            }), 409

    # Commit order status update in its own transaction
    try:
        order.status = 'submitted'
        order.submitted_at = datetime.now(timezone.utc)
        order.mqtt_status = 'pending'
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception("Failed to submit order")
        return jsonify({"msg": "Failed to submit order"}), 500

    # Publish to MQTT — failure here does NOT roll back the order
    publish_order = get_mqtt_service()
    mqtt_result = {'success': False, 'message_id': None, 'error': 'mqtt_service unavailable'}

    if publish_order:
        try:
            mqtt_result = publish_order(order, order.items)
        except Exception as e:
            logger.exception("MQTT publish raised an exception")
            mqtt_result = {'success': False, 'message_id': None, 'error': str(e)}

    # Update MQTT status based on publish result
    try:
        if mqtt_result.get('success'):
            order.mqtt_status = 'published'
            order.mqtt_message_id = mqtt_result.get('message_id')
        else:
            order.mqtt_status = 'failed'
            logger.warning(f"[MQTT] Publish failed for order {order.id}: {mqtt_result.get('error')}")
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception("Failed to update MQTT status")

    response = {
        "order": order.to_dict(include_items=True),
        "mqtt_published": mqtt_result.get('success', False),
    }
    if not mqtt_result.get('success'):
        response["mqtt_warning"] = (
            "Order created, but Smart Cart communication is temporarily unavailable. "
            "Your order is saved and can be retried."
        )

    return jsonify(response), 200


@app.route('/api/orders/<int:order_id>/items/<int:item_id>', methods=['PATCH'])
@jwt_required()
def update_order_item(order_id, item_id):
    """Update quantity of an item. Only allowed on draft orders."""
    user_id = int(get_jwt_identity())
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"msg": "Order not found"}), 404
    if order.user_id != user_id:
        return jsonify({"msg": "Access denied"}), 403
    if order.status != 'draft':
        return jsonify({"msg": "Cannot modify a submitted order"}), 409

    item = OrderItem.query.filter_by(id=item_id, order_id=order_id).first()
    if not item:
        return jsonify({"msg": "Item not found"}), 404

    data = request.get_json() or {}
    new_qty = data.get('quantity')
    if new_qty is None or int(new_qty) <= 0:
        return jsonify({"msg": "Quantity must be at least 1"}), 400

    new_qty = int(new_qty)
    product = Product.query.get(item.product_id)
    if product and product.stock < new_qty:
        return jsonify({"msg": f"Only {product.stock} units of '{product.name}' are available"}), 409

    item.quantity = new_qty
    item.subtotal = round(item.unit_price * new_qty, 2)
    order.total_amount = round(sum(i.subtotal for i in order.items), 2)
    db.session.commit()
    return jsonify({"msg": "Item updated", "order": order.to_dict(include_items=True)}), 200


@app.route('/api/orders/<int:order_id>/items/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_order_item(order_id, item_id):
    """Remove an item from a draft order."""
    user_id = int(get_jwt_identity())
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"msg": "Order not found"}), 404
    if order.user_id != user_id:
        return jsonify({"msg": "Access denied"}), 403
    if order.status != 'draft':
        return jsonify({"msg": "Cannot modify a submitted order"}), 409

    item = OrderItem.query.filter_by(id=item_id, order_id=order_id).first()
    if not item:
        return jsonify({"msg": "Item not found"}), 404

    db.session.delete(item)
    order.total_amount = round(sum(i.subtotal for i in order.items if i.id != item_id), 2)
    db.session.commit()
    return jsonify({"msg": "Item removed", "order": order.to_dict(include_items=True)}), 200


# ---------------------------------------------------------------------------
# Admin routes
# ---------------------------------------------------------------------------

@app.route('/api/admin/orders', methods=['GET'])
@jwt_required()
def admin_get_orders():
    """Admin-only: get all orders with user info."""
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({"msg": "Admin access required"}), 403

    orders = Order.query.order_by(Order.created_at.desc()).all()
    result = []
    for order in orders:
        data = order.to_dict(include_items=True)
        user = User.query.get(order.user_id)
        data['user_email'] = user.email if user else 'Unknown'
        result.append(data)
    return jsonify(result), 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
