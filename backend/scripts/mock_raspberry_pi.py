#!/usr/bin/env python3
"""
scripts/mock_raspberry_pi.py — Development Simulator

This script simulates the future Raspberry Pi 5 MQTT subscriber.
It connects to the MQTT broker, subscribes to the order topic,
and prints received orders in a readable format.

IMPORTANT: This is a DEVELOPMENT TOOL ONLY.
It does NOT represent actual robot behaviour (no navigation, no picking, etc.)
Replace with the real Pi application when the hardware arrives.

Usage:
  # Default: subscribes to smartcart/orders/cart-01
  python scripts/mock_raspberry_pi.py

  # Custom cart ID
  DEFAULT_CART_ID=cart-02 python scripts/mock_raspberry_pi.py

Requirements:
  pip install paho-mqtt

When MQTT_MODE=mock in the backend, no broker is running, so this
simulator will fail to connect — that is expected. To use this simulator:
  1. Install Mosquitto: brew install mosquitto
  2. Start broker: mosquitto -v
  3. Set MQTT_MODE=real in backend .env
  4. Restart Flask
  5. Run this simulator
  6. Submit an order in the app
"""

import json
import os
import sys
import time

MQTT_BROKER_HOST = os.environ.get('MQTT_BROKER_HOST', 'localhost')
MQTT_BROKER_PORT = int(os.environ.get('MQTT_BROKER_PORT', '1883'))
MQTT_USERNAME = os.environ.get('MQTT_USERNAME', '')
MQTT_PASSWORD = os.environ.get('MQTT_PASSWORD', '')
MQTT_TOPIC_PREFIX = os.environ.get('MQTT_TOPIC_PREFIX', 'smartcart')
DEFAULT_CART_ID = os.environ.get('DEFAULT_CART_ID', 'cart-01')
SEND_ACK = os.environ.get('SEND_ACK', 'true').lower() == 'true'

ORDER_TOPIC = f"{MQTT_TOPIC_PREFIX}/orders/{DEFAULT_CART_ID}"
ACK_TOPIC = f"{MQTT_TOPIC_PREFIX}/ack/{DEFAULT_CART_ID}"


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"\n[MOCK RASPBERRY PI] Connected to broker at {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
        print(f"[MOCK RASPBERRY PI] Subscribed to: {ORDER_TOPIC}")
        print("[MOCK RASPBERRY PI] Waiting for orders...\n")
        client.subscribe(ORDER_TOPIC, qos=1)
    else:
        print(f"[MOCK RASPBERRY PI] Connection failed with code {rc}")
        sys.exit(1)


def on_message(client, userdata, msg):
    print("\n" + "=" * 60)
    print("[MOCK RASPBERRY PI] ORDER RECEIVED!")
    print("=" * 60)

    try:
        payload = json.loads(msg.payload.decode('utf-8'))
    except json.JSONDecodeError:
        print(f"[MOCK RASPBERRY PI] ERROR: Invalid JSON payload")
        print(msg.payload.decode('utf-8'))
        return

    print(f"  Message ID : {payload.get('message_id', 'N/A')}")
    print(f"  Order ID   : {payload.get('order_id', 'N/A')}")
    print(f"  Cart ID    : {payload.get('cart_id', 'N/A')}")
    print(f"  Command    : {payload.get('command', 'N/A')}")
    print(f"  Timestamp  : {payload.get('timestamp', 'N/A')}")
    print()
    print("  Items to Pick:")
    print("  " + "-" * 40)
    items = payload.get('items', [])
    for item in items:
        name = item.get('product_name', 'Unknown')
        qty = item.get('quantity', 0)
        pid = item.get('product_id', '?')
        print(f"    [{pid}] {name} × {qty}")
    print("  " + "-" * 40)
    print(f"  Total items: {sum(i.get('quantity', 0) for i in items)}")
    print()

    # Send acknowledgement back to backend (future use)
    if SEND_ACK:
        ack_payload = {
            "message_id": payload.get('message_id'),
            "order_id": payload.get('order_id'),
            "cart_id": DEFAULT_CART_ID,
            "status": "received",
            "note": "Mock Pi acknowledging order — no real robot action taken",
        }
        client.publish(ACK_TOPIC, json.dumps(ack_payload), qos=1)
        print(f"[MOCK RASPBERRY PI] Acknowledgement sent to: {ACK_TOPIC}")

    print("=" * 60 + "\n")


def on_disconnect(client, userdata, rc):
    if rc != 0:
        print(f"\n[MOCK RASPBERRY PI] Unexpected disconnect (rc={rc}). Reconnecting...")


def main():
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        print("ERROR: paho-mqtt not installed.")
        print("Run: pip install paho-mqtt")
        sys.exit(1)

    client = mqtt.Client(client_id=f"mock-rpi-{DEFAULT_CART_ID}")
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    print(f"[MOCK RASPBERRY PI] Connecting to {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}...")

    try:
        client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, keepalive=60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n[MOCK RASPBERRY PI] Stopped by user.")
        client.disconnect()
    except ConnectionRefusedError:
        print(f"\n[MOCK RASPBERRY PI] ERROR: Could not connect to broker at {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
        print("Make sure a MQTT broker (e.g. Mosquitto) is running.")
        print("Start with: mosquitto -v")
        sys.exit(1)


if __name__ == '__main__':
    main()
