"""
order_status.py — Applies smart-cart progress to Order.shopping_state
(shared by the MQTT subscriber and PATCH /api/orders/<id>/shopping-state)

Cart states published on cartmate/cart/<cart_id>/status:
  order_received | picking | picked | pick_failed | unknown_item | order_done | order_failed

Only Order.shopping_state (and completed_at / pickup_eta) is written here — NEVER Order.status.
"""

import logging
from datetime import datetime, timezone

from models import db, Order, OrderEvent

logger = logging.getLogger(__name__)

# Cart state -> Order.shopping_state (states not listed only record an OrderEvent)
CART_STATE_TO_SHOPPING_STATE = {
    'picking': 'picking',
    'picked': 'picking',
    'order_done': 'completed',
    'order_failed': 'needs_attention',
    'pick_failed': 'needs_attention',
}

# States that can be set through PATCH /api/orders/<id>/shopping-state
ALLOWED_SHOPPING_STATES = ('waiting', 'picking', 'completed', 'needs_attention')

# Once completed, late/out-of-order cart messages must not move the order backwards
TERMINAL_SHOPPING_STATES = ('completed',)

# Keep needs_attention visible while the cart keeps picking the remaining items
STICKY_SHOPPING_STATES = ('needs_attention',)


def parse_order_id(raw):
    """'ORD_0002' -> 2, '2' -> 2, 2 -> 2; returns None when it cannot be parsed."""
    if raw is None:
        return None
    if isinstance(raw, int):
        return raw
    text = str(raw).strip().upper()
    if text.startswith('ORD_'):
        text = text[4:]
    return int(text) if text.isdigit() else None


def _truncate(value, length):
    if value is None:
        return None
    text = value if isinstance(value, str) else str(value)
    return text[:length]


def current_shopping_state(order: Order) -> str:
    return order.shopping_state or 'waiting'


def record_event(order: Order, state: str, item=None, detail=None) -> OrderEvent:
    event = OrderEvent(
        order_id=order.id,
        state=_truncate(state, 30),
        item=_truncate(item, 120),
        detail=_truncate(detail, 255),
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(event)
    return event


def set_shopping_state(order: Order, new_state: str) -> bool:
    """Set Order.shopping_state with completion bookkeeping. Returns True when it changed."""
    current = current_shopping_state(order)
    if new_state == current:
        return False
    if current in TERMINAL_SHOPPING_STATES:
        logger.info(f"[CartMate] Ignoring shopping_state '{new_state}' for {order.order_code}: already {current}")
        return False

    order.shopping_state = new_state
    if new_state == 'completed':
        now = datetime.now(timezone.utc)
        order.completed_at = now
        order.pickup_eta = now  # Replace the checkout estimate with the real finish time
        # TODO(push): when User.push_token exists, send an Expo push here, e.g.
        #   send_expo_push(order.user.push_token, "Your shopping is finished!", ...)
        # (POST https://exp.host/--/api/v2/push/send). Not implemented: the app polls + uses local notifications.
    return True


def apply_cart_state(order: Order, state: str, item=None, detail=None) -> bool:
    """Record a cart progress message and update shopping_state. Caller commits."""
    record_event(order, state, item=item, detail=detail)
    new_state = CART_STATE_TO_SHOPPING_STATE.get(state)
    if not new_state:
        return False
    if current_shopping_state(order) in STICKY_SHOPPING_STATES and new_state == 'picking':
        return False
    return set_shopping_state(order, new_state)
