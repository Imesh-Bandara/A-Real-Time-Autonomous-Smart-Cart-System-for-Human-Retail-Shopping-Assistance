#!/usr/bin/env python3
"""
scripts/mock_raspberry_pi.py — CartMate Autonomous Shopping Cart Simulator

Simulates the onboard Raspberry Pi controller for CartMate.
Subscribes to topic: cartmate/navigation/target
Displays received waypoints, map coordinates, and items to be retrieved at each shelf.
"""

import json
import os
import sys

MQTT_BROKER_HOST = os.environ.get('MQTT_BROKER_HOST', 'localhost')
MQTT_BROKER_PORT = int(os.environ.get('MQTT_BROKER_PORT', '1883'))
MQTT_USERNAME = os.environ.get('MQTT_USERNAME', '')
MQTT_PASSWORD = os.environ.get('MQTT_PASSWORD', '')
MQTT_TARGET_TOPIC = os.environ.get('MQTT_TARGET_TOPIC', 'cartmate/navigation/target')
DEFAULT_CART_ID = os.environ.get('DEFAULT_CART_ID', 'CART_01')


def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print(f"\n[CARTMATE RASPBERRY PI] Connected to broker at {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
        print(f"[CARTMATE RASPBERRY PI] Subscribed to topic: {MQTT_TARGET_TOPIC}")
        print("[CARTMATE RASPBERRY PI] Waiting for navigation commands from mobile app...\n")
        client.subscribe(MQTT_TARGET_TOPIC, qos=1)
        client.subscribe(f"smartcart/orders/{DEFAULT_CART_ID}", qos=1)
    else:
        print(f"[CARTMATE RASPBERRY PI] Connection failed with code {rc}")
        sys.exit(1)


def on_message(client, userdata, msg):
    print("\n" + "=" * 65)
    print(f"[CARTMATE RASPBERRY PI] NAVIGATION TARGET RECEIVED on '{msg.topic}'!")
    print("=" * 65)

    try:
        payload = json.loads(msg.payload.decode('utf-8'))
    except json.JSONDecodeError:
        print("[CARTMATE RASPBERRY PI] ERROR: Invalid JSON payload")
        print(msg.payload.decode('utf-8'))
        return

    order_id = payload.get('order_id', 'N/A')
    cart_id = payload.get('cart_id', 'N/A')
    created_at = payload.get('created_at', payload.get('timestamp', 'N/A'))
    waypoints = payload.get('waypoints', [])

    print(f"  Order ID    : {order_id}")
    print(f"  Target Cart : {cart_id}")
    print(f"  Created At  : {created_at}")
    print(f"  Total Stops : {len(waypoints)}")
    print()

    if waypoints:
        print("  Autonomous Navigation Route:")
        print("  " + "-" * 55)
        for idx, wp in enumerate(waypoints, start=1):
            shelf_id = wp.get('shelf_id', 'UNKNOWN')
            x = wp.get('x', 0.0)
            y = wp.get('y', 0.0)
            items = wp.get('items', [])
            items_str = ", ".join(items) if items else "No items listed"
            print(f"    Stop {idx}: [{shelf_id}] Map: ({x}m, {y}m)")
            print(f"            Items: {items_str}")
        print("  " + "-" * 55)
    elif 'items' in payload:
        # Legacy payload format fallback
        print("  Items to Pick:")
        for item in payload.get('items', []):
            print(f"    - {item.get('product_name', 'Item')} x {item.get('quantity', 1)}")

    print("=" * 65 + "\n")


def on_disconnect(client, userdata, rc, properties=None):
    if rc != 0:
        print(f"\n[CARTMATE RASPBERRY PI] Unexpected disconnect (rc={rc}). Reconnecting...")


def main():
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        print("ERROR: paho-mqtt not installed. Run: pip install paho-mqtt")
        sys.exit(1)

    cid = f"cartmate-rpi-{DEFAULT_CART_ID}"
    if hasattr(mqtt, 'CallbackAPIVersion') and hasattr(mqtt.CallbackAPIVersion, 'VERSION2'):
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=cid)
    else:
        client = mqtt.Client(client_id=cid)

    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    print(f"[CARTMATE RASPBERRY PI] Connecting to MQTT broker at {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}...")
    try:
        client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, keepalive=60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n[CARTMATE RASPBERRY PI] Simulator terminated by user.")
        client.disconnect()
    except Exception as e:
        print(f"\n[CARTMATE RASPBERRY PI] Connection error: {e}")
        print("Note: To run a local MQTT broker on macOS: brew install mosquitto && mosquitto")
        print("The backend runs in mock mode by default when a broker is not present.")


if __name__ == '__main__':
    main()
