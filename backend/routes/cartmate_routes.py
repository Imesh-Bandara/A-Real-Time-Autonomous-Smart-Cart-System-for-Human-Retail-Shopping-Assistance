import hmac
import logging
import os
from datetime import datetime, timedelta, timezone
from flask import Blueprint, jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, jwt_required
from models import db, Shelf, ShelfSection, Product, Order, OrderItem, OrderEvent, iso_utc
from mqtt_service import publish_navigation_route, DEFAULT_CART_ID
import otp_service
from order_status import ALLOWED_SHOPPING_STATES, set_shopping_state, record_event, current_shopping_state

logger = logging.getLogger(__name__)

cartmate_bp = Blueprint('cartmate', __name__)

# Pickup time estimate at checkout: now + (waypoints * PER_WAYPOINT) + BASE.
# Overwritten with the real finish time when the cart reports order_done.
PICKUP_MINUTES_PER_WAYPOINT = 3
PICKUP_BASE_MINUTES = 5

ORDER_EVENTS_LIMIT = 20


def _optional_user_id():
    """User id from a valid JWT, or None. A missing/expired/invalid token never blocks the request."""
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        return int(identity) if identity is not None else None
    except Exception:
        return None


def _as_utc(value):
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


LOCALHOST_ADDRS = ('127.0.0.1', '::1')


def _cart_key_error(allow_localhost_without_key=False):
    """
    Validate the X-Cart-Key shared secret (env CART_API_KEY). Returns an error response or None.
    allow_localhost_without_key: when CART_API_KEY is NOT set, accept requests from this machine only
    (local testing). Uses the socket address, not X-Forwarded-For, so it cannot be spoofed by a header.
    """
    expected = os.environ.get('CART_API_KEY')
    if not expected:
        if allow_localhost_without_key and request.remote_addr in LOCALHOST_ADDRS:
            return None
        if allow_localhost_without_key:
            return jsonify({"msg": "CART_API_KEY is not set: only requests from 127.0.0.1 are allowed"}), 403
        logger.error("[CartMate] CART_API_KEY is not set; cart-only endpoints are disabled.")
        return jsonify({"msg": "Cart API key is not configured on the server"}), 503
    provided = request.headers.get('X-Cart-Key', '')
    if not hmac.compare_digest(provided.encode('utf-8'), expected.encode('utf-8')):
        return jsonify({"msg": "Invalid or missing X-Cart-Key"}), 401
    return None


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
        now = datetime.now(timezone.utc)
        order = Order(
            user_id=_optional_user_id(),
            cart_id=cart_id,
            status='sent_to_cart',
            total_amount=round(total_amount, 2),
            mqtt_status='pending',
            created_at=now,
            submitted_at=now,
            payment_status='unpaid',
            shopping_state='waiting',
            otp_attempts=0,
            otp_locked=False,
            pickup_eta=now + timedelta(
                minutes=len(waypoints) * PICKUP_MINUTES_PER_WAYPOINT + PICKUP_BASE_MINUTES
            ),
        )
        db.session.add(order)
        db.session.flush()
        # Session number uses the store's local date, e.g. SES-20261020-0002
        order.session_code = f"SES-{datetime.now().strftime('%Y%m%d')}-{order.id:04d}"

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
            # Additive fields for the payment / confirmation flow
            "id": order.id,
            "session_code": order.session_code,
            "payment_status": order.payment_status,
            "shopping_state": order.shopping_state,
            "pickup_eta": iso_utc(order.pickup_eta),
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


def _current_user_id():
    identity = get_jwt_identity()
    return int(identity) if identity is not None else None


# ---------------------------------------------------------------------------
# 4. POST /api/orders/<id>/pay  (MOCK payment — no real gateway)
# Requires the customer's JWT; the order must belong to them. Marks the order paid and
# issues the pickup OTP (stored encrypted). Idempotent: paying again keeps the same OTP.
# ---------------------------------------------------------------------------
@cartmate_bp.route('/api/orders/<int:order_id>/pay', methods=['POST'])
@jwt_required()
def pay_order(order_id):
    try:
        # Row lock (PostgreSQL) so a double tap cannot issue two OTPs
        order = db.session.query(Order).filter_by(id=order_id).with_for_update().first()
        if not order:
            return jsonify({"status": "error", "msg": "Order not found"}), 404

        if order.user_id is None or order.user_id != _current_user_id():
            db.session.rollback()
            return jsonify({"status": "error", "msg": "This order does not belong to your account"}), 403

        response = {
            "status": "success",
            "id": order.id,
            "order_id": order.order_code,
            "cart_id": order.cart_id,
            "payment_status": "paid",
        }

        if order.payment_status == 'paid':
            response.update({
                "msg": "Order is already paid",
                "otp_already_issued": True,
                "paid_at": iso_utc(order.paid_at),
                "otp_expires_at": iso_utc(order.otp_expires_at),
                "order": order.to_dict(include_items=True),
            })
            db.session.rollback()
            return jsonify(response), 200

        now = datetime.now(timezone.utc)
        otp = otp_service.generate_otp()
        order.payment_status = 'paid'
        order.paid_at = now
        order.otp_encrypted = otp_service.encrypt_otp(otp)
        order.otp_expires_at = otp_service.otp_expiry_from(now)
        order.otp_attempts = 0
        order.otp_locked = False
        record_event(order, 'payment_received', detail='Mock payment')
        db.session.commit()
        logger.info(f"[CartMate] {order.order_code} paid; pickup OTP issued (expires {iso_utc(order.otp_expires_at)})")

        response.update({
            "msg": "Payment successful",
            "otp": otp,
            "otp_already_issued": False,
            "paid_at": iso_utc(order.paid_at),
            "otp_expires_at": iso_utc(order.otp_expires_at),
            "order": order.to_dict(include_items=True),
        })
        return jsonify(response), 200
    except Exception as e:
        db.session.rollback()
        logger.exception("Payment processing failed")
        return jsonify({"status": "error", "msg": "Payment processing failed", "error": str(e)}), 500


def _otp_unavailable_reason(order):
    """Why a paid order's OTP cannot be used right now, or None."""
    if order.otp_locked:
        return 'locked', "OTP is locked after too many wrong attempts. Please see staff."
    expires_at = _as_utc(order.otp_expires_at)
    if not expires_at or expires_at <= datetime.now(timezone.utc):
        return 'expired', "OTP has expired. Please see staff."
    return None


# ---------------------------------------------------------------------------
# 4b. GET /api/orders/<id>/otp  (customer app — owner only, paid orders only)
# ---------------------------------------------------------------------------
@cartmate_bp.route('/api/orders/<int:order_id>/otp', methods=['GET'])
@jwt_required()
def get_order_otp(order_id):
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"msg": "Order not found"}), 404
    if order.user_id is None or order.user_id != _current_user_id():
        return jsonify({"msg": "This order does not belong to your account"}), 403
    if order.payment_status != 'paid' or not order.otp_encrypted:
        return jsonify({"msg": "Order is not paid yet. Pay to get your pickup OTP.", "reason": "not_paid"}), 409
    unavailable = _otp_unavailable_reason(order)
    if unavailable:
        return jsonify({"msg": unavailable[1], "reason": unavailable[0],
                        "expires_at": iso_utc(order.otp_expires_at)}), 409
    try:
        otp = otp_service.decrypt_otp(order.otp_encrypted)
    except otp_service.OtpDecryptError as e:
        logger.error(f"[CartMate] {order.order_code}: {e}")
        return jsonify({"msg": "OTP is unavailable, please see staff", "reason": "otp_unreadable"}), 500
    return jsonify({
        "order_id": order.order_code,
        "cart_id": order.cart_id,
        "otp": otp,
        "expires_at": iso_utc(order.otp_expires_at),
    }), 200


# ---------------------------------------------------------------------------
# 4c. GET /api/carts/<cart_id>/current-otp  (Raspberry Pi OLED — header X-Cart-Key)
# Latest paid order of this cart that finished shopping, is not picked up, expired or locked.
# ---------------------------------------------------------------------------
CURRENT_OTP_SCAN_LIMIT = 10


@cartmate_bp.route('/api/carts/<cart_id>/current-otp', methods=['GET'])
def get_cart_current_otp(cart_id):
    key_error = _cart_key_error()
    if key_error:
        return key_error

    candidates = (Order.query
                  .filter(db.func.upper(Order.cart_id) == cart_id.strip().upper(),
                          Order.payment_status == 'paid',
                          Order.shopping_state == 'completed',
                          Order.otp_encrypted.isnot(None),
                          Order.picked_up_at.is_(None))
                  .order_by(Order.completed_at.desc(), Order.id.desc())
                  .limit(CURRENT_OTP_SCAN_LIMIT).all())
    for order in candidates:
        if _otp_unavailable_reason(order):
            continue
        try:
            otp = otp_service.decrypt_otp(order.otp_encrypted)
        except otp_service.OtpDecryptError as e:
            logger.error(f"[CartMate] {order.order_code}: {e}")
            continue
        return jsonify({
            "order_id": order.order_code,
            "otp": otp,
            "expires_at": iso_utc(order.otp_expires_at),
        }), 200
    return jsonify({"msg": f"No order is ready for pickup at {cart_id}"}), 404


# ---------------------------------------------------------------------------
# 5. POST /api/orders/<id>/verify-otp  (called by the cart / Raspberry Pi)
# Header: X-Cart-Key: <CART_API_KEY>   Body: {"otp": "123456", "cart_id": "CART_01"}
# ---------------------------------------------------------------------------
@cartmate_bp.route('/api/orders/<int:order_id>/verify-otp', methods=['POST'])
def verify_order_otp(order_id):
    key_error = _cart_key_error()
    if key_error:
        return key_error

    max_attempts = otp_service.OTP_MAX_ATTEMPTS

    def result(valid, order, status_code=200, reason=None):
        body = {
            "valid": valid,
            "attempts_left": max(0, max_attempts - (order.otp_attempts or 0)),
            "locked": bool(order.otp_locked),
        }
        if reason:
            body["reason"] = reason
        return jsonify(body), status_code

    data = request.get_json(silent=True) or {}
    otp = str(data.get('otp') or '').replace(' ', '').strip()
    cart_id = str(data.get('cart_id') or '').strip().upper()
    if not otp or not cart_id:
        return jsonify({"valid": False, "attempts_left": None, "locked": False,
                        "reason": "missing_fields", "msg": "'otp' and 'cart_id' are required"}), 400

    try:
        order = db.session.query(Order).filter_by(id=order_id).with_for_update().first()
        if not order:
            return jsonify({"valid": False, "attempts_left": None, "locked": False,
                            "reason": "order_not_found"}), 404

        response = None
        if order.payment_status != 'paid' or not order.otp_encrypted:
            response = result(False, order, 409, 'not_paid')
        elif cart_id != (order.cart_id or '').upper():
            response = result(False, order, 403, 'wrong_cart')
        elif order.otp_locked:
            response = result(False, order, 423, 'locked')
        else:
            expires_at = _as_utc(order.otp_expires_at)
            if not expires_at or expires_at <= datetime.now(timezone.utc):
                response = result(False, order, 410, 'expired')
        if response:
            db.session.rollback()
            return response

        if otp_service.otp_matches(otp, order.otp_encrypted):
            order.otp_attempts = 0
            if not order.picked_up_at:
                order.picked_up_at = datetime.now(timezone.utc)  # Order.status is left unchanged
            record_event(order, 'otp_verified', detail=f"Verified at {cart_id}")
            response = result(True, order)
            db.session.commit()
            return response

        order.otp_attempts = (order.otp_attempts or 0) + 1
        if order.otp_attempts >= max_attempts:
            order.otp_locked = True
            record_event(order, 'otp_locked', detail=f"{order.otp_attempts} wrong OTP attempts")
            logger.warning(f"[CartMate] OTP locked for {order.order_code} after {order.otp_attempts} wrong attempts")
            response = result(False, order, 423, 'locked')
        else:
            response = result(False, order, 200, 'wrong_otp')
        db.session.commit()
        return response
    except otp_service.OtpDecryptError as e:
        db.session.rollback()
        logger.error(f"[CartMate] ORD_{order_id:04d}: {e}")
        return jsonify({"valid": False, "attempts_left": None, "locked": False,
                        "reason": "otp_unreadable"}), 500
    except Exception as e:
        db.session.rollback()
        logger.exception("OTP verification failed")
        return jsonify({"valid": False, "attempts_left": None, "locked": False,
                        "reason": "server_error", "error": str(e)}), 500


# ---------------------------------------------------------------------------
# 6. PATCH /api/orders/<id>/shopping-state  (simulate the cart without an MQTT broker)
# Header: X-Cart-Key: <CART_API_KEY>   Body: {"state": "completed"}
# If CART_API_KEY is not set, only requests from 127.0.0.1 are accepted (local testing).
# Writes Order.shopping_state only — never Order.status.
# ---------------------------------------------------------------------------
@cartmate_bp.route('/api/orders/<int:order_id>/shopping-state', methods=['PATCH'])
def update_shopping_state(order_id):
    key_error = _cart_key_error(allow_localhost_without_key=True)
    if key_error:
        return key_error

    data = request.get_json(silent=True) or {}
    new_state = str(data.get('state') or '').strip().lower()
    if new_state not in ALLOWED_SHOPPING_STATES:
        return jsonify({
            "msg": f"Invalid state. Allowed: {', '.join(ALLOWED_SHOPPING_STATES)}"
        }), 400

    order = Order.query.get(order_id)
    if not order:
        return jsonify({"msg": "Order not found"}), 404

    try:
        if current_shopping_state(order) == 'completed' and new_state != 'completed':
            return jsonify({"msg": "Shopping is already completed", "order": order.to_dict(include_items=True)}), 409
        changed = set_shopping_state(order, new_state)
        if changed:
            record_event(order, new_state, detail='Set via PATCH /shopping-state')
        db.session.commit()
        return jsonify({
            "msg": f"Order {order.order_code} shopping_state is '{current_shopping_state(order)}'",
            "changed": changed,
            "order": order.to_dict(include_items=True),
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to update shopping state")
        return jsonify({"msg": "Failed to update shopping state", "error": str(e)}), 500


# ---------------------------------------------------------------------------
# 7. GET /api/orders/<id>/events  (latest cart progress messages, oldest first)
# ---------------------------------------------------------------------------
@cartmate_bp.route('/api/orders/<int:order_id>/events', methods=['GET'])
def get_order_events(order_id):
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"msg": "Order not found"}), 404
    events = (OrderEvent.query.filter_by(order_id=order_id)
              .order_by(OrderEvent.id.desc()).limit(ORDER_EVENTS_LIMIT).all())
    return jsonify([e.to_dict() for e in reversed(events)]), 200
