import os
import uuid
import logging
from datetime import datetime, timezone
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, get_jwt
)
from werkzeug.utils import secure_filename

from models import db, Shelf, Product, User, Order, OrderItem
from routes.cartmate_routes import cartmate_bp
from init_db import seed_database
import mqtt_service

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Database Configuration — PostgreSQL via SQLAlchemy (with resilient dev fallback)
# ---------------------------------------------------------------------------
POSTGRES_USER = os.environ.get('POSTGRES_USER', 'postgres')
POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD', 'postgres')
POSTGRES_HOST = os.environ.get('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = os.environ.get('POSTGRES_PORT', '5432')
POSTGRES_DB = os.environ.get('POSTGRES_DB', 'cartmate')

default_pg_uri = f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
database_uri = os.environ.get('DATABASE_URL', default_pg_uri)

# Test if PostgreSQL is reachable or if we should use fallback
try:
    if 'postgresql' in database_uri:
        import psycopg2
        # Quick check for PostgreSQL connectivity
        conn = psycopg2.connect(
            dbname=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            connect_timeout=2
        )
        conn.close()
        logger.info(f"[DB] Connected to PostgreSQL at {POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}")
except Exception as e:
    logger.warning(
        f"[DB] PostgreSQL not directly reachable ({e}). "
        f"Using SQLite fallback for local development (sqlite:///cartmate.db). "
        f"Set DATABASE_URL to connect to live PostgreSQL."
    )
    database_uri = os.environ.get('DATABASE_FALLBACK_URL', 'sqlite:///cartmate.db')

app.config['SQLALCHEMY_DATABASE_URI'] = database_uri
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'super-secret-key-change-in-production')
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5 MB max upload

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads', 'products')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db.init_app(app)
CORS(app)
jwt = JWTManager(app)

# Register modular CartMate API Blueprint
app.register_blueprint(cartmate_bp)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


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


with app.app_context():
    seed_database(app)


# ---------------------------------------------------------------------------
# General & Auth Routes
# ---------------------------------------------------------------------------

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "status": "Success",
        "system": "CartMate Autonomous Shopping Cart API",
        "endpoints": {
            "products": "GET /api/products",
            "shelves": "GET /api/shelves",
            "checkout": "POST /api/orders/checkout",
            "mqtt_topic": "cartmate/navigation/target"
        }
    })


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
    return jsonify(access_token=access_token, role=user.role, email=user.email), 200


# ---------------------------------------------------------------------------
# Product Management (Admin POST/DELETE)
# ---------------------------------------------------------------------------

@app.route('/api/products', methods=['POST'])
def add_product():
    is_multipart = request.content_type and 'multipart/form-data' in request.content_type
    if is_multipart:
        name = request.form.get('name')
        price = request.form.get('price')
        stock = request.form.get('stock')
        shelf_id = request.form.get('shelf_id')
        shelf_section = request.form.get('shelf_section')
        description = request.form.get('description')
        image_url = request.form.get('image_url')
        image_file = request.files.get('image')
    else:
        data = request.get_json() or {}
        name = data.get('name')
        price = data.get('price')
        stock = data.get('stock')
        shelf_id = data.get('shelf_id')
        shelf_section = data.get('shelf_section')
        description = data.get('description')
        image_url = data.get('image_url')
        image_file = None

    if not name or price is None:
        return jsonify({"msg": "Missing required fields (name, price)"}), 400

    try:
        sec = int(shelf_section) if (shelf_section and str(shelf_section).isdigit()) else 1
        new_product = Product(
            name=name,
            price=float(price),
            stock=int(stock) if stock is not None else 50,
            shelf_id=shelf_id,
            shelf_section=sec if shelf_id else None,
            image_url=image_url,
            description=description.strip() if description else None,
        )
        db.session.add(new_product)
        db.session.flush()
        if image_file:
            saved_filename = save_product_image(image_file, new_product.id)
            if saved_filename:
                new_product.image_path = saved_filename
        db.session.commit()
        return jsonify({
            "msg": "Product added successfully!",
            "product": new_product.to_dict(include_shelf=True)
        }), 201
    except (ValueError, TypeError):
        db.session.rollback()
        return jsonify({"msg": "Invalid price or stock value"}), 400
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to add product")
        return jsonify({"msg": "Failed to add product", "error": str(e)}), 500


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
# Order History Routes
# ---------------------------------------------------------------------------

@app.route('/api/orders', methods=['GET'])
@jwt_required(optional=True)
def get_orders():
    """List orders, newest first."""
    identity = get_jwt_identity()
    if identity:
        orders = Order.query.filter_by(user_id=int(identity)).order_by(Order.created_at.desc()).all()
    else:
        orders = Order.query.order_by(Order.created_at.desc()).limit(20).all()
    return jsonify([o.to_dict(include_items=True) for o in orders]), 200


@app.route('/api/orders/<int:order_id>', methods=['GET'])
def get_order(order_id):
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"msg": "Order not found"}), 404
    return jsonify(order.to_dict(include_items=True)), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
