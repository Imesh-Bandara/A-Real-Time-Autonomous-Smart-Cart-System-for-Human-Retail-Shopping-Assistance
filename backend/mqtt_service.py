"""
mqtt_service.py — CartMate Dedicated MQTT Helper Service

Publishes navigation waypoints to autonomous shopping cart controllers (Raspberry Pi).
Topic: cartmate/navigation/target

Payload Schema:
{
  "order_id": "ORD_1001",
  "cart_id": "CART_01",
  "created_at": "2026-10-15T11:00:00Z",
  "waypoints": [
    {
      "shelf_id": "SHELF_A",
      "shelf_coords": { "x": 1.5, "y": 2.0, "orientation_theta": 0.0 },
      "section": 1,
      "section_coords": { "x": 1.5, "y": 2.0, "orientation_theta": 0.0 },
      "x": 1.5,
      "y": 2.0,
      "orientation_theta": 0.0,
      "items": ["Apple"]
    },
    {
      "shelf_id": "SHELF_A",
      "shelf_coords": { "x": 1.5, "y": 2.0, "orientation_theta": 0.0 },
      "section": 3,
      "section_coords": { "x": 2.1, "y": 2.0, "orientation_theta": 0.0 },
      "x": 2.1,
      "y": 2.0,
      "orientation_theta": 0.0,
      "items": ["Banana"]
    }
  ]
}
"""

import os
import json
import uuid
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# MQTT Broker Configuration
# ---------------------------------------------------------------------------
MQTT_MODE = os.environ.get('MQTT_MODE', 'mock').lower()
MQTT_BROKER_HOST = os.environ.get('MQTT_BROKER_HOST', 'localhost')
MQTT_BROKER_PORT = int(os.environ.get('MQTT_BROKER_PORT', '1883'))
MQTT_USERNAME = os.environ.get('MQTT_USERNAME', '')
MQTT_PASSWORD = os.environ.get('MQTT_PASSWORD', '')
MQTT_CLIENT_ID = os.environ.get('MQTT_CLIENT_ID', 'cartmate-backend')
MQTT_TLS_ENABLED = os.environ.get('MQTT_TLS_ENABLED', 'false').lower() == 'true'
MQTT_TARGET_TOPIC = os.environ.get('MQTT_TARGET_TOPIC', 'cartmate/navigation/target')
MQTT_QOS = int(os.environ.get('MQTT_QOS', '1'))
MQTT_MAX_RETRIES = int(os.environ.get('MQTT_MAX_RETRIES', '3'))
DEFAULT_CART_ID = os.environ.get('DEFAULT_CART_ID', 'CART_01')


def create_mqtt_client(client_id_prefix: str = None):
    """Factory function to instantiate compatible paho-mqtt client."""
    import paho.mqtt.client as mqtt

    cid = f"{client_id_prefix or MQTT_CLIENT_ID}-{uuid.uuid4().hex[:6]}"
    if hasattr(mqtt, 'CallbackAPIVersion') and hasattr(mqtt.CallbackAPIVersion, 'VERSION2'):
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=cid)
    else:
        client = mqtt.Client(client_id=cid)

    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    if MQTT_TLS_ENABLED:
        client.tls_set()

    return client


def build_navigation_payload(order_id: str, cart_id: str, waypoints: list, created_at: str = None) -> dict:
    """Format navigation target payload adhering to CartMate specifications."""
    if not created_at:
        created_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return {
        "order_id": order_id,
        "cart_id": cart_id or DEFAULT_CART_ID,
        "created_at": created_at,
        "waypoints": waypoints,
    }


def _publish_mock(topic: str, payload: dict, message_id: str) -> dict:
    """Mock publisher for local development and testing without live broker."""
    payload_str = json.dumps(payload, indent=2)
    logger.info("=" * 60)
    logger.info(f"[CARTMATE MQTT MOCK] Topic: {topic}")
    logger.info(f"[CARTMATE MQTT MOCK] QoS: {MQTT_QOS} | Message ID: {message_id}")
    logger.info(f"[CARTMATE MQTT MOCK] Payload:\n{payload_str}")
    logger.info("=" * 60)

    # Print to console for immediate visibility during local runs
    print(f"\n{'='*60}\n[CARTMATE MQTT MOCK] Target Topic: {topic}\nPayload:\n{payload_str}\n{'='*60}\n")
    return {
        "success": True,
        "message_id": message_id,
        "mode": "mock",
        "topic": topic,
        "payload": payload,
    }


def _publish_real(topic: str, payload: dict, message_id: str) -> dict:
    """Publish message to live MQTT broker using paho-mqtt with retry logic."""
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        logger.error("[CARTMATE MQTT] paho-mqtt not installed.")
        return {"success": False, "message_id": message_id, "error": "paho-mqtt not installed"}

    payload_str = json.dumps(payload)
    last_error = None

    for attempt in range(1, MQTT_MAX_RETRIES + 1):
        try:
            client = create_mqtt_client()
            client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, keepalive=15)
            result = client.publish(topic, payload_str, qos=MQTT_QOS)
            client.disconnect()

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"[CARTMATE MQTT] Successfully published to {topic} (attempt {attempt})")
                return {
                    "success": True,
                    "message_id": message_id,
                    "mode": "real",
                    "topic": topic,
                    "payload": payload,
                }
            else:
                last_error = f"MQTT publish returned error code rc={result.rc}"
                logger.warning(f"[CARTMATE MQTT] Attempt {attempt} failed: {last_error}")
        except Exception as e:
            last_error = str(e)
            logger.warning(f"[CARTMATE MQTT] Attempt {attempt} connection exception: {last_error}")

    logger.warning(f"[CARTMATE MQTT] Real MQTT broker unreachable at {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}. Falling back to mock logging.")
    fallback_res = _publish_mock(topic, payload, message_id)
    fallback_res["warning"] = f"Live broker unreachable ({last_error}). Logged in mock mode."
    return fallback_res


def publish_navigation_route(order_id: str, cart_id: str, waypoints: list, topic: str = None) -> dict:
    """
    Main MQTT route publisher invoked upon order checkout.

    Args:
        order_id: Formatted order identifier (e.g., 'ORD_1001')
        cart_id: Smart cart target identifier (e.g., 'CART_01')
        waypoints: List of dicts: [{'shelf_id': 'SHELF_A', 'x': 1.5, 'y': 2.0, 'items': ['Apple']}, ...]
        topic: MQTT topic (defaults to cartmate/navigation/target)

    Returns:
        dict: {'success': bool, 'message_id': str, 'mode': str, 'payload': dict, ...}
    """
    target_topic = topic or MQTT_TARGET_TOPIC
    message_id = str(uuid.uuid4())
    payload = build_navigation_payload(order_id, cart_id, waypoints)

    if MQTT_MODE == 'real':
        return _publish_real(target_topic, payload, message_id)
    else:
        return _publish_mock(target_topic, payload, message_id)


# Backward-compatibility alias for legacy code
def publish_order(order, items):
    order_code = getattr(order, 'order_code', f"ORD_{order.id:04d}")
    cart_id = getattr(order, 'cart_id', DEFAULT_CART_ID)
    
    # Group items by shelf if available
    shelf_groups = {}
    for item in items:
        p = getattr(item, 'product', None)
        shelf_id = getattr(p, 'shelf_id', 'SHELF_UNKNOWN') if p else 'SHELF_UNKNOWN'
        shelf_obj = getattr(p, 'shelf', None) if p else None
        
        if shelf_id not in shelf_groups:
            shelf_groups[shelf_id] = {
                'shelf_id': shelf_id,
                'x': getattr(shelf_obj, 'x_coord', 0.0) if shelf_obj else 0.0,
                'y': getattr(shelf_obj, 'y_coord', 0.0) if shelf_obj else 0.0,
                'items': [],
            }
        item_name = getattr(p, 'name', f"Product {item.product_id}") if p else f"Product {item.product_id}"
        shelf_groups[shelf_id]['items'].append(item_name)

    waypoints = list(shelf_groups.values())
    return publish_navigation_route(order_code, cart_id, waypoints)
