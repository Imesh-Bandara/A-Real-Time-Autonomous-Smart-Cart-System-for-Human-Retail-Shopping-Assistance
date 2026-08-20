from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///supermarket.db'
app.config['JWT_SECRET_KEY'] = 'super-secret-key-change-in-production'

db = SQLAlchemy(app)
CORS(app)
jwt = JWTManager(app)

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, nullable=False)

with app.app_context():
    db.create_all()
    if not User.query.filter_by(email="admin@test.com").first():
        admin = User(email="admin@test.com", password="admin123", role="admin")
        customer = User(email="user@test.com", password="user123", role="customer")
        item1 = Product(name="Fresh Apples", price=2.99, stock=50)
        item2 = Product(name="Organic Milk", price=3.49, stock=30)
        
        db.session.add_all([admin, customer, item1, item2])
        db.session.commit()

@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "Success", "message": "Supermarket API is running!"})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter_by(email=email, password=password).first()
    if not user:
        return jsonify({"msg": "Invalid credentials"}), 401
    
    # Pass user ID as a string identity, and extra data in additional_claims
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role}
    )
    return jsonify(access_token=access_token, role=user.role, email=user.email), 200

# Get all products
@app.route('/api/products', methods=['GET'])
def get_products():
    products = Product.query.all()
    output = []
    for p in products:
        output.append({'id': p.id, 'name': p.name, 'price': p.price, 'stock': p.stock})
    return jsonify(output), 200

# Add a new product (Admin action)
@app.route('/api/products', methods=['POST'])
def add_product():
    data = request.get_json() or {}
    try:
        new_product = Product(
            name=data['name'],
            price=float(data['price']),
            stock=int(data['stock'])
        )
        db.session.add(new_product)
        db.session.commit()
        return jsonify({"msg": "Product added successfully!"}), 201
    except KeyError:
        return jsonify({"msg": "Missing required fields (name, price, stock)"}), 400

# Delete a product (Admin action)
@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    product = Product.query.get(product_id)
    if not product:
        return jsonify({"msg": "Product not found"}), 404
    
    db.session.delete(product)
    db.session.commit()
    return jsonify({"msg": "Product deleted successfully!"}), 200

if __name__ == '__main__':
    # Listen on 0.0.0.0 to allow access from local network and emulators
    app.run(debug=True, host='0.0.0.0', port=5000)