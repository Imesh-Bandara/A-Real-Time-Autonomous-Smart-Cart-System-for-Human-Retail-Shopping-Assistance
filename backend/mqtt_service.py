"""
mqtt_service.py — Smart Cart MQTT Abstraction Layer

Supports two modes:
  MQTT_MODE=mock   — No broker required. Logs payload. Safe for development.
  MQTT_MODE=real   — Connects to real MQTT broker via paho-mqtt.

When the Raspberry Pi 5 arrives, set MQTT_MODE=real and configure broker
credentials in environment variables. No other changes needed.
"""

import os
import json
import uuid
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Environment configuration
# ---------------------------------------------------------------------------
MQTT_MODE = os.environ.get('MQTT_MODE', 'mock').lower()
MQTT_BROKER_HOST = os.environ.get('MQTT_BROKER_HOST', 'localhost')
MQTT_BROKER_PORT = int(os.environ.get('MQTT_BROKER_PORT', '1883'))
MQTT_USERNAME = os.environ.get('MQTT_USERNAME', '')
MQTT_PASSWORD = os.environ.get('MQTT_PASSWORD', '')
MQTT_CLIENT_ID = os.environ.get('MQTT_CLIENT_ID', 'smartcart-backend')
MQTT_TLS_ENABLED = os.environ.get('MQTT_TLS_ENABLED', 'false').lower() == 'true'
MQTT_TOPIC_PREFIX = os.environ.get('MQTT_TOPIC_PREFIX', 'smartcart')
MQTT_QOS = int(os.environ.get('MQTT_QOS', '1'))
DEFAULT_CART_ID = os.environ.get('DEFAULT_CART_ID', 'cart-01')

# Max retries for real MQTT mode
MQTT_MAX_RETRIES = int(os.environ.get('MQTT_MAX_RETRIES', '3'))


def _build_payload(order, items, message_id: str, cart_id: str) -> dict:
    """Build the structured MQTT JSON payload."""
    return {
        "message_id": message_id,
        "command": "PICK_ORDER",
        "order_id": order.id,
        "cart_id": cart_id,
        "user_id": order.user_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product.name if item.product else "Unknown",
                "quantity": item.quantity,
            }
            for item in items
        ],
    }


def _publish_mock(topic: str, payload: dict, message_id: str) -> dict:
    """
    Mock MQTT publisher — no broker required.
    Logs the full payload to console. Safe for development.
    """
    payload_str = json.dumps(payload, indent=2)
    logger.info("\n" + "=" * 60)
    logger.info("[MQTT MOCK] Would publish to broker:")
    logger.info(f"  Topic : {topic}")
    logger.info(f"  QoS   : {MQTT_QOS}")
    logger.info(f"  Mode  : mock (no broker required)")
    logger.info(f"  Payload:\n{payload_str}")
    logger.info("=" * 60)

    # Print to stdout so it shows in Flask's dev server console
    print(f"\n{'='*60}")
    print(f"[MQTT MOCK] Topic: {topic}")
    print(f"[MQTT MOCK] Payload:\n{payload_str}")
    print(f"{'='*60}\n")

    return {"success": True, "message_id": message_id, "mode": "mock"}


def _publish_real(topic: str, payload: dict, message_id: str) -> dict:
    """
    Real MQTT publisher — uses paho-mqtt.
    Requires: pip install paho-mqtt
    Retries up to MQTT_MAX_RETRIES times before giving up.
    """
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        logger.error("[MQTT] paho-mqtt not installed. Run: pip install paho-mqtt")
        return {"success": False, "message_id": message_id, "error": "paho-mqtt not installed"}

    payload_str = json.dumps(payload)
    last_error = None

    for attempt in range(1, MQTT_MAX_RETRIES + 1):
        try:
            client = mqtt.Client(client_id=f"{MQTT_CLIENT_ID}-{uuid.uuid4().hex[:6]}")

            if MQTT_USERNAME:
                client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

            if MQTT_TLS_ENABLED:
                client.tls_set()

            client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, keepalive=10)
            result = client.publish(topic, payload_str, qos=MQTT_QOS)
            client.disconnect()

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"[MQTT] Published to {topic} (attempt {attempt})")
                return {"success": True, "message_id": message_id, "mode": "real"}
            else:
                last_error = f"MQTT publish returned rc={result.rc}"
                logger.warning(f"[MQTT] Attempt {attempt} failed: {last_error}")

        except Exception as e:
            last_error = str(e)
            logger.warning(f"[MQTT] Attempt {attempt} exception: {last_error}")

    logger.error(f"[MQTT] All {MQTT_MAX_RETRIES} publish attempts failed. Last error: {last_error}")
    return {"success": False, "message_id": message_id, "error": last_error}


def publish_order(order, items) -> dict:
    """
    Main entry point called by app.py after order is submitted.

    Args:
        order: Order model instance
        items: list of OrderItem instances

    Returns:
        dict with keys: success (bool), message_id (str), mode (str), error (str|None)
    """
    message_id = str(uuid.uuid4())
    cart_id = DEFAULT_CART_ID  # Future: dynamically assign cart
    topic = f"{MQTT_TOPIC_PREFIX}/orders/{cart_id}"
    payload = _build_payload(order, items, message_id, cart_id)

    if MQTT_MODE == 'real':
        return _publish_real(topic, payload, message_id)
    else:
        # Default to mock for safety
        return _publish_mock(topic, payload, message_id)
