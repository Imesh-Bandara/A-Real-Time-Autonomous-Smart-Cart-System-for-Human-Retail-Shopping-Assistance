import logging
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from models import db, Shelf, ShelfSection, Product, Order, OrderItem
from mqtt_service import publish_navigation_route, DEFAULT_CART_ID

logger = logging.getLogger(__name__)

cartmate_bp = Blueprint('cartmate', __name__)


# ---------------------------------------------------------------------------
# 1. Shelf Management Endpoints
# ---------------------------------------------------------------------------
@cartmate_bp.route('/api/shelves', methods=['GET'])
def get_shelves():
    """Fetch all shelves. Supports query param ?include_products=true"""
    try:
        include_prods = request.args.get('include_products', 'true').lower() == 'true'
        shelves = Shelf.query.order_by(Shelf.id.asc()).all()
        return jsonify([s.to_dict(include_products=include_prods) for s in shelves]), 200
    except Exception as e:
        logger.exception("Failed to fetch shelves")
        return jsonify({"msg": "Failed to fetch shelves", "error": str(e)}), 500


@cartmate_bp.route('/api/shelves', methods=['POST'])
def create_shelf():
    """Create a new shelf with ID, name, coordinates, and orientation."""
    data = request.get_json() or {}
    shelf_id = (data.get('id') or '').strip().upper()
    name = (data.get('name') or '').strip()
    x_coord = data.get('x_coord')
    y_coord = data.get('y_coord')
    orientation_theta = data.get('orientation_theta', 0.0)

    if not shelf_id or not name:
        return jsonify({"msg": "Missing required fields: 'id' and 'name' are required"}), 400
    if x_coord is None or y_coord is None:
        return jsonify({"msg": "Missing map coordinates: 'x_coord' and 'y_coord' are required"}), 400

    try:
        existing = Shelf.query.get(shelf_id)
        if existing:
            return jsonify({"msg": f"Shelf with ID '{shelf_id}' already exists"}), 409

        shelf = Shelf(
            id=shelf_id,
            name=name,
            x_coord=float(x_coord),
            y_coord=float(y_coord),
            orientation_theta=float(orientation_theta or 0.0)
        )
        db.session.add(shelf)
        db.session.commit()
        return jsonify({
            "msg": f"Shelf '{shelf_id}' created successfully",
            "shelf": shelf.to_dict(include_products=True)
        }), 201
    except (ValueError, TypeError) as e:
        db.session.rollback()
        return jsonify({"msg": "Invalid coordinate or orientation values", "error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to create shelf")
        return jsonify({"msg": "Failed to create shelf", "error": str(e)}), 500


@cartmate_bp.route('/api/shelves/<shelf_id>', methods=['PUT', 'PATCH'])
def update_shelf(shelf_id):
    """Update shelf details (name, coordinates, orientation)."""
    shelf = Shelf.query.get(shelf_id)
    if not shelf:
        return jsonify({"msg": f"Shelf '{shelf_id}' not found"}), 404

    data = request.get_json() or {}
    try:
        if 'name' in data and data['name']:
            shelf.name = str(data['name']).strip()
        if 'x_coord' in data and data['x_coord'] is not None:
            shelf.x_coord = float(data['x_coord'])
        if 'y_coord' in data and data['y_coord'] is not None:
            shelf.y_coord = float(data['y_coord'])
        if 'orientation_theta' in data and data['orientation_theta'] is not None:
            shelf.orientation_theta = float(data['orientation_theta'])

        db.session.commit()
        return jsonify({
            "msg": f"Shelf '{shelf_id}' updated successfully",
            "shelf": shelf.to_dict(include_products=True)
        }), 200
    except (ValueError, TypeError) as e:
        db.session.rollback()
        return jsonify({"msg": "Invalid numeric coordinates or orientation", "error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to update shelf")
        return jsonify({"msg": "Failed to update shelf", "error": str(e)}), 500


@cartmate_bp.route('/api/shelves/<shelf_id>', methods=['DELETE'])
def delete_shelf(shelf_id):
    """Delete shelf and unassign products currently placed on it."""
    shelf = Shelf.query.get(shelf_id)
    if not shelf:
        return jsonify({"msg": f"Shelf '{shelf_id}' not found"}), 404

    try:
        # Unlink products on this shelf
        for prod in shelf.products:
            prod.shelf_id = None
        db.session.flush()

        db.session.delete(shelf)
        db.session.commit()
        return jsonify({"msg": f"Shelf '{shelf_id}' deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to delete shelf")
        return jsonify({"msg": "Failed to delete shelf", "error": str(e)}), 500


# ---------------------------------------------------------------------------
# 1b. Shelf Section Coordinate Endpoints
# ---------------------------------------------------------------------------
@cartmate_bp.route('/api/shelves/<shelf_id>/sections', methods=['GET'])
def get_shelf_sections(shelf_id):
    """Fetch all 5 section coordinates for a shelf (returns defaults if not set)."""
    shelf = Shelf.query.get(shelf_id)
    if not shelf:
        return jsonify({"msg": f"Shelf '{shelf_id}' not found"}), 404
    return jsonify(shelf.sections_dict()), 200


@cartmate_bp.route('/api/shelves/<shelf_id>/sections/<int:section_number>', methods=['PUT', 'PATCH'])
def update_shelf_section(shelf_id, section_number):
    """Create or update the navigation coordinates for a specific shelf section (1-5)."""
    if section_number < 1 or section_number > 5:
        return jsonify({"msg": "section_number must be between 1 and 5"}), 400

    shelf = Shelf.query.get(shelf_id)
    if not shelf:
        return jsonify({"msg": f"Shelf '{shelf_id}' not found"}), 404

    data = request.get_json() or {}
    try:
        x_coord = float(data.get('x_coord', 0.0))
        y_coord = float(data.get('y_coord', 0.0))
        orientation_theta = float(data.get('orientation_theta', 0.0))
    except (ValueError, TypeError):
        return jsonify({"msg": "Invalid coordinate values — must be numeric"}), 400

    try:
        existing = ShelfSection.query.filter_by(
            shelf_id=shelf_id, section_number=section_number
        ).first()

        if existing:
            existing.x_coord = x_coord
            existing.y_coord = y_coord
            existing.orientation_theta = orientation_theta
        else:
            db.session.add(ShelfSection(
                shelf_id=shelf_id,
                section_number=section_number,
                x_coord=x_coord,
                y_coord=y_coord,
                orientation_theta=orientation_theta,
            ))

        db.session.commit()
        return jsonify({
            "msg": f"Section {section_number} coordinates saved for '{shelf_id}'",
            "sections": shelf.sections_dict(),
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to update shelf section")
        return jsonify({"msg": "Failed to update shelf section", "error": str(e)}), 500


@cartmate_bp.route('/api/products/<int:product_id>/shelf', methods=['PATCH', 'PUT'])
def assign_product_shelf(product_id):
    """Assign or re-assign a product to a shelf and section (1 to 5)."""
    product = Product.query.get(product_id)
    if not product:
        return jsonify({"msg": f"Product with ID {product_id} not found"}), 404

    data = request.get_json() or {}
    shelf_id = data.get('shelf_id')
    shelf_section = data.get('shelf_section')

    try:
        if shelf_id:
            shelf = Shelf.query.get(shelf_id)
            if not shelf:
                return jsonify({"msg": f"Shelf with ID '{shelf_id}' does not exist"}), 404
            product.shelf_id = shelf.id
            if shelf_section is not None and str(shelf_section).strip():
                sec = int(shelf_section)
                if 1 <= sec <= 5:
                    product.shelf_section = sec
                else:
                    return jsonify({"msg": "shelf_section must be an integer between 1 and 5"}), 400
            elif not product.shelf_section:
                product.shelf_section = 1
        else:
            product.shelf_id = None
            product.shelf_section = None

        db.session.commit()
        return jsonify({
            "msg": f"Product '{product.name}' shelf updated to '{product.shelf_id or 'None'}' Section {product.shelf_section or 'None'}",
            "product": product.to_dict(include_shelf=True)
        }), 200
    except (ValueError, TypeError):
        db.session.rollback()
        return jsonify({"msg": "Invalid shelf_section value (must be 1-5)"}), 400
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to update product shelf assignment")
        return jsonify({"msg": "Failed to assign product shelf", "error": str(e)}), 500


@cartmate_bp.route('/api/products/<int:product_id>', methods=['PATCH', 'PUT'])
def update_product(product_id):
    """Admin endpoint to edit existing product details, shelf, and section."""
    product = Product.query.get(product_id)
    if not product:
        return jsonify({"msg": f"Product with ID {product_id} not found"}), 404

    is_multipart = request.content_type and 'multipart/form-data' in request.content_type
    if is_multipart:
        data = request.form
    else:
        data = request.get_json() or {}

    try:
        if 'name' in data and data['name']:
            product.name = data['name'].strip()
        if 'price' in data and data['price'] is not None:
            product.price = float(data['price'])
        if 'stock' in data and data['stock'] is not None:
            product.stock = int(data['stock'])
        if 'description' in data:
            product.description = data['description'].strip() if data['description'] else None

        if 'shelf_id' in data:
            shelf_id = data['shelf_id']
            if shelf_id:
                shelf = Shelf.query.get(shelf_id)
                if not shelf:
                    return jsonify({"msg": f"Shelf '{shelf_id}' does not exist"}), 404
                product.shelf_id = shelf.id
            else:
                product.shelf_id = None
                product.shelf_section = None

        if 'shelf_section' in data:
            sec_val = data['shelf_section']
            if sec_val is not None and str(sec_val).strip():
                sec = int(sec_val)
                if 1 <= sec <= 5:
                    product.shelf_section = sec
                else:
                    return jsonify({"msg": "shelf_section must be between 1 and 5"}), 400
            elif product.shelf_id:
                product.shelf_section = product.shelf_section or 1

        db.session.commit()
        return jsonify({
            "msg": f"Product '{product.name}' updated successfully",
            "product": product.to_dict(include_shelf=True)
        }), 200
    except (ValueError, TypeError):
        db.session.rollback()
        return jsonify({"msg": "Invalid numerical value for price, stock, or shelf_section"}), 400
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to update product")
        return jsonify({"msg": "Failed to update product", "error": str(e)}), 500



# ---------------------------------------------------------------------------
# 2. GET /api/products
# Fetch list of available products with their associated shelf information
# ---------------------------------------------------------------------------
@cartmate_bp.route('/api/products', methods=['GET'])
def get_products():
    try:
        products = Product.query.order_by(Product.id.asc()).all()
        return jsonify([p.to_dict(include_shelf=True) for p in products]), 200
    except Exception as e:
        logger.exception("Failed to fetch products")
        return jsonify({"msg": "Failed to fetch products", "error": str(e)}), 500


# ---------------------------------------------------------------------------
# 3. POST /api/orders/checkout
# Accepts product IDs, queries shelf coordinates, groups waypoints, publishes MQTT
# ---------------------------------------------------------------------------
@cartmate_bp.route('/api/orders/checkout', methods=['POST'])
def checkout_order():
    """
    CartMate Autonomous Navigation Checkout:
    1. Accepts selected product IDs from React Native app
    2. Queries PostgreSQL/SQLAlchemy for product shelf_id and coordinates (x_coord, y_coord)
    3. Groups selected items by shelf to prevent duplicate waypoint stops
    4. Publishes structured MQTT navigation payload to topic: cartmate/navigation/target
    """
    data = request.get_json() or {}

    # Support multiple formats: { "product_ids": [1, 2] }, { "items": [{ "product_id": 1 }] }, or list [1, 2]
    product_ids = []
    if isinstance(data, list):
        product_ids = [int(x) for x in data if str(x).isdigit()]
    elif 'product_ids' in data:
        product_ids = [int(x) for x in data['product_ids'] if str(x).isdigit()]
    elif 'items' in data:
        for item in data['items']:
            pid = item.get('product_id') or item.get('id')
            if pid is not None and str(pid).isdigit():
                product_ids.append(int(pid))

    if not product_ids:
        return jsonify({
            "status": "error",
            "msg": "No product IDs provided. Request body must include 'product_ids': [1, 2, ...]"
        }), 400

    cart_id = data.get('cart_id') or DEFAULT_CART_ID

    try:
        # Step 2: Query database to retrieve selected products and their associated shelf
        # Using preserve_order / distinct list of IDs
        unique_ids = list(dict.fromkeys(product_ids))
        products = Product.query.filter(Product.id.in_(unique_ids)).all()

        if not products:
            return jsonify({
                "status": "error",
                "msg": f"No valid products found for the provided IDs: {unique_ids}"
            }), 404

        # Step 3: Group selected items by shelf to prevent duplicate waypoint stops
        shelf_group_map = {}
        total_amount = 0.0

        for product in products:
            total_amount += product.price
            shelf = product.shelf
            section_num = product.shelf_section or 1

            if shelf:
                shelf_id = shelf.id
                shelf_x = shelf.x_coord
                shelf_y = shelf.y_coord
                shelf_theta = shelf.orientation_theta

                # Fetch section-level coordinates (falls back to base shelf offset if not set)
                sec_coords = shelf.get_section_coords(section_num)
                sec_x = sec_coords['x']
                sec_y = sec_coords['y']
                sec_theta = sec_coords['orientation_theta']
            elif product.shelf_id:
                shelf_id = product.shelf_id
                shelf_x, shelf_y, shelf_theta = 0.0, 0.0, 0.0
                sec_x, sec_y, sec_theta = 0.0, 0.0, 0.0
            else:
                shelf_id = "SHELF_UNASSIGNED"
                shelf_x, shelf_y, shelf_theta = 0.0, 0.0, 0.0
                sec_x, sec_y, sec_theta = 0.0, 0.0, 0.0

            # Group by shelf_id + section so each section gets a separate waypoint stop
            group_key = f"{shelf_id}__sec{section_num}"
            if group_key not in shelf_group_map:
                shelf_group_map[group_key] = {
                    "shelf_id": shelf_id,
                    "shelf_coords": {
                        "x": round(shelf_x, 3),
                        "y": round(shelf_y, 3),
                        "orientation_theta": shelf_theta,
                    },
                    "section": section_num,
                    "section_coords": {
                        "x": round(sec_x, 3),
                        "y": round(sec_y, 3),
                        "orientation_theta": sec_theta,
                    },
                    # Top-level coordinates point directly to the section target
                    "x": round(sec_x, 3),
                    "y": round(sec_y, 3),
                    "orientation_theta": sec_theta,
                    "items": [],
                }

            if product.name not in shelf_group_map[group_key]["items"]:
                shelf_group_map[group_key]["items"].append(product.name)

        # Build clean waypoints list conforming to CartMate specification
        waypoints = [
            {
                "shelf_id": grp["shelf_id"],
                "shelf_coords": grp["shelf_coords"],
                "section": grp["section"],
                "section_coords": grp["section_coords"],
                "x": grp["x"],
                "y": grp["y"],
                "orientation_theta": grp["orientation_theta"],
                "items": grp["items"],
            }
            for grp in shelf_group_map.values()
        ]

        # Record Order in database
        order = Order(
            cart_id=cart_id,
            status='sent_to_cart',
            total_amount=round(total_amount, 2),
            mqtt_status='pending',
            created_at=datetime.now(timezone.utc),
            submitted_at=datetime.now(timezone.utc),
        )
        db.session.add(order)
        db.session.flush()

        # Add Order Items
        for p in products:
            order_item = OrderItem(
                order_id=order.id,
                product_id=p.id,
                quantity=1,
                unit_price=p.price,
                subtotal=p.price,
            )
            db.session.add(order_item)

        order_code = f"ORD_{order.id:04d}"

        # Step 4: Publish MQTT payload to topic 'cartmate/navigation/target'
        mqtt_result = publish_navigation_route(
            order_id=order_code,
            cart_id=cart_id,
            waypoints=waypoints,
        )

        # Update order with MQTT execution status
        if mqtt_result.get('success'):
            order.mqtt_status = 'published'
            order.mqtt_message_id = mqtt_result.get('message_id')
        else:
            order.mqtt_status = 'failed'

        db.session.commit()

        response_payload = {
            "status": "success",
            "order_id": order_code,
            "cart_id": cart_id,
            "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "waypoints": waypoints,
            "total_amount": round(total_amount, 2),
            "mqtt_topic": mqtt_result.get('topic', 'cartmate/navigation/target'),
            "mqtt_published": mqtt_result.get('success', False),
            "mqtt_mode": mqtt_result.get('mode', 'mock'),
            "message": f"Navigation route with {len(waypoints)} waypoint(s) transmitted to CartMate ({cart_id})",
        }

        if mqtt_result.get('warning'):
            response_payload["warning"] = mqtt_result["warning"]

        return jsonify(response_payload), 200

    except Exception as e:
        db.session.rollback()
        logger.exception("Checkout processing failed")
        return jsonify({
            "status": "error",
            "msg": "Checkout processing failed",
            "error": str(e)
        }), 500
