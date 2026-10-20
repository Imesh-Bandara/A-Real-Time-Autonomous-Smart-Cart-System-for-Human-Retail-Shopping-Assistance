"""
test_order_flow.py — checkout -> pay -> OTP -> cart current-otp -> verify-otp -> shopping state

Run:  venv\\Scripts\\python.exe -m unittest test_order_flow -v
Uses a throw-away SQLite database, a temp uploads folder, mock MQTT and test secrets (set before importing the app).
"""

import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

from cryptography.fernet import Fernet

_TMP_DIR = tempfile.mkdtemp(prefix='cartmate_test_')
os.environ['DATABASE_URL'] = 'sqlite:///' + os.path.join(_TMP_DIR, 'test.db').replace('\\', '/')
os.environ['MQTT_MODE'] = 'mock'
os.environ['CART_API_KEY'] = 'test-cart-key'
os.environ['OTP_ENC_KEY'] = Fernet.generate_key().decode()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import init_db  # noqa: E402
init_db.UPLOAD_DIR = os.path.join(_TMP_DIR, 'uploads')  # keep seeded photo copies out of the real uploads/

from app import app  # noqa: E402
from models import db, Order, User  # noqa: E402
import mqtt_service  # noqa: E402
import otp_service  # noqa: E402
from routes.cartmate_routes import PICKUP_BASE_MINUTES, PICKUP_MINUTES_PER_WAYPOINT  # noqa: E402

CART_HEADERS = {'X-Cart-Key': 'test-cart-key'}


def _parse(ts):
    return datetime.fromisoformat(ts.replace('Z', '+00:00'))


def setUpModule():
    with app.app_context():
        if not User.query.filter_by(email='other@test.com').first():
            db.session.add(User(email='other@test.com', password='other123', role='customer'))
            db.session.commit()


class OrderFlowTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.user_auth = self.login('user@test.com', 'user123')
        self.other_auth = self.login('other@test.com', 'other123')

    # -- helpers ---------------------------------------------------------
    def login(self, email, password):
        token = self.client.post('/api/login', json={'email': email, 'password': password}).get_json()['access_token']
        return {'Authorization': f'Bearer {token}'}

    def checkout(self, headers=None, cart_id='CART_01'):
        res = self.client.post('/api/orders/checkout', json={'cart_id': cart_id, 'product_ids': [1, 2]},
                               headers=self.user_auth if headers is None else headers)
        self.assertEqual(res.status_code, 200, res.get_json())
        return res.get_json()

    def pay(self, order_id, headers=None):
        res = self.client.post(f'/api/orders/{order_id}/pay', headers=headers or self.user_auth)
        self.assertEqual(res.status_code, 200, res.get_json())
        return res.get_json()

    def get_otp(self, order_id, headers=None):
        return self.client.get(f'/api/orders/{order_id}/otp', headers=self.user_auth if headers is None else headers)

    def paid_order(self, cart_id='CART_01'):
        order_id = self.checkout(cart_id=cart_id)['id']
        self.pay(order_id)
        return order_id, self.get_otp(order_id).get_json()['otp']

    def set_state(self, order_id, state):
        res = self.client.patch(f'/api/orders/{order_id}/shopping-state', json={'state': state}, headers=CART_HEADERS)
        self.assertEqual(res.status_code, 200, res.get_json())
        return res.get_json()['order']

    def verify(self, order_id, otp, cart_id='CART_01', headers=CART_HEADERS):
        return self.client.post(f'/api/orders/{order_id}/verify-otp',
                                json={'otp': otp, 'cart_id': cart_id}, headers=headers)

    def current_otp(self, cart_id='CART_01', headers=CART_HEADERS):
        return self.client.get(f'/api/carts/{cart_id}/current-otp', headers=headers)

    @staticmethod
    def wrong_otp(otp):
        return '000000' if otp != '000000' else '111111'

    # -- checkout --------------------------------------------------------
    def test_checkout_with_token_links_customer(self):
        before = datetime.now(timezone.utc)
        data = self.checkout()
        self.assertEqual(data['order_id'], f"ORD_{data['id']:04d}")
        self.assertRegex(data['session_code'], r'^SES-\d{8}-%04d$' % data['id'])
        expected = before + timedelta(minutes=len(data['waypoints']) * PICKUP_MINUTES_PER_WAYPOINT
                                      + PICKUP_BASE_MINUTES)
        self.assertLess(abs((_parse(data['pickup_eta']) - expected).total_seconds()), 10)

        order = self.client.get(f"/api/orders/{data['id']}").get_json()
        self.assertEqual(order['customer_name'], 'User')  # email prefix, capitalised
        self.assertIsNotNone(order['user_id'])
        self.assertEqual(order['status'], 'sent_to_cart')
        self.assertEqual(order['shopping_state'], 'waiting')
        self.assertEqual(order['payment_status'], 'unpaid')

    def test_checkout_without_token_still_works(self):
        data = self.checkout(headers={})
        order = self.client.get(f"/api/orders/{data['id']}").get_json()
        self.assertIsNone(order['user_id'])
        self.assertIsNone(order['customer_name'])
        # An invalid/expired token must not break checkout either
        self.assertEqual(self.checkout(headers={'Authorization': 'Bearer not-a-token'})['status'], 'success')

    # -- pay -------------------------------------------------------------
    def test_pay_requires_owner(self):
        order_id = self.checkout()['id']
        self.assertEqual(self.client.post(f'/api/orders/{order_id}/pay').status_code, 401)
        self.assertEqual(self.client.post(f'/api/orders/{order_id}/pay', headers=self.other_auth).status_code, 403)
        guest_order = self.checkout(headers={})['id']
        self.assertEqual(self.client.post(f'/api/orders/{guest_order}/pay', headers=self.user_auth).status_code, 403)
        self.assertEqual(self.client.post('/api/orders/999999/pay', headers=self.user_auth).status_code, 404)

    def test_otp_issued_once_and_stored_encrypted(self):
        order_id = self.checkout()['id']
        first = self.pay(order_id)
        self.assertFalse(first['otp_already_issued'])
        self.assertRegex(first['otp'], r'^\d{6}$')

        second = self.pay(order_id)
        self.assertTrue(second['otp_already_issued'])
        self.assertNotIn('otp', second)
        self.assertEqual(self.get_otp(order_id).get_json()['otp'], first['otp'])  # same OTP after paying again

        with app.app_context():
            stored = db.session.get(Order, order_id).otp_encrypted
        self.assertNotIn(first['otp'], stored)
        self.assertEqual(otp_service.decrypt_otp(stored), first['otp'])

        # Never in the order JSON
        for payload in (self.client.get(f'/api/orders/{order_id}').get_json(), second['order'],
                        *self.client.get('/api/orders', headers=self.user_auth).get_json()):
            self.assertNotIn('otp', payload)
            self.assertNotIn('otp_encrypted', payload)

    # -- GET /otp --------------------------------------------------------
    def test_get_otp_owner_other_unpaid(self):
        order_id = self.checkout()['id']
        unpaid = self.get_otp(order_id)
        self.assertEqual(unpaid.status_code, 409)
        self.assertEqual(unpaid.get_json()['reason'], 'not_paid')

        issued = self.pay(order_id)['otp']
        owner = self.get_otp(order_id)
        self.assertEqual(owner.status_code, 200)
        self.assertEqual(owner.get_json()['otp'], issued)
        self.assertIsNotNone(owner.get_json()['expires_at'])

        self.assertEqual(self.get_otp(order_id, headers=self.other_auth).status_code, 403)
        self.assertEqual(self.get_otp(order_id, headers={}).status_code, 401)
        self.assertEqual(self.get_otp(999999).status_code, 404)

    # -- cart current-otp ------------------------------------------------
    def test_cart_current_otp(self):
        cart = 'CART_77'  # own cart id so other tests do not interfere
        self.assertEqual(self.current_otp(cart, headers={}).status_code, 401)
        self.assertEqual(self.current_otp(cart).status_code, 404)

        order_id, otp = self.paid_order(cart_id=cart)
        self.assertEqual(self.current_otp(cart).status_code, 404)  # not completed yet

        self.set_state(order_id, 'completed')
        res = self.current_otp(cart)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['order_id'], f'ORD_{order_id:04d}')
        self.assertEqual(res.get_json()['otp'], otp)  # same OTP as the customer's app

        # Unpaid completed orders are never shown
        unpaid = self.checkout(cart_id=cart)['id']
        self.set_state(unpaid, 'completed')
        self.assertEqual(self.current_otp(cart).get_json()['order_id'], f'ORD_{order_id:04d}')

        # After pickup it is no longer the current OTP
        self.assertEqual(self.verify(order_id, otp, cart_id=cart).status_code, 200)
        self.assertEqual(self.current_otp(cart).status_code, 404)

    def test_cart_current_otp_skips_expired_and_locked(self):
        cart = 'CART_78'
        order_id, _ = self.paid_order(cart_id=cart)
        self.set_state(order_id, 'completed')
        with app.app_context():
            db.session.get(Order, order_id).otp_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
            db.session.commit()
        self.assertEqual(self.current_otp(cart).status_code, 404)

    # -- verify-otp ------------------------------------------------------
    def test_verify_ok_sets_picked_up_not_status(self):
        order_id, otp = self.paid_order()
        self.assertEqual(self.verify(order_id, otp, headers={}).status_code, 401)
        res = self.verify(order_id, otp)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json(), {'valid': True, 'attempts_left': 3, 'locked': False})
        order = self.client.get(f'/api/orders/{order_id}').get_json()
        self.assertIsNotNone(order['picked_up_at'])
        self.assertEqual(order['status'], 'sent_to_cart')

    def test_verify_wrong_then_lock_after_three(self):
        order_id, otp = self.paid_order()
        bad = self.wrong_otp(otp)
        r1 = self.verify(order_id, bad)
        self.assertEqual((r1.status_code, r1.get_json()['valid'], r1.get_json()['attempts_left']), (200, False, 2))
        self.assertEqual(self.verify(order_id, bad).get_json()['attempts_left'], 1)
        r3 = self.verify(order_id, bad)
        self.assertEqual(r3.status_code, 423)
        self.assertEqual(r3.get_json(), {'valid': False, 'attempts_left': 0, 'locked': True, 'reason': 'locked'})
        self.assertEqual(self.verify(order_id, otp).status_code, 423)  # correct OTP refused once locked
        self.assertEqual(self.get_otp(order_id).get_json()['reason'], 'locked')

    def test_verify_expired(self):
        order_id, otp = self.paid_order()
        with app.app_context():
            db.session.get(Order, order_id).otp_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
            db.session.commit()
        res = self.verify(order_id, otp)
        self.assertEqual(res.status_code, 410)
        self.assertEqual(res.get_json()['reason'], 'expired')
        self.assertEqual(self.get_otp(order_id).get_json()['reason'], 'expired')

    def test_verify_wrong_cart(self):
        order_id, otp = self.paid_order()
        res = self.verify(order_id, otp, cart_id='CART_02')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.get_json()['reason'], 'wrong_cart')
        self.assertEqual(res.get_json()['attempts_left'], 3)  # a wrong cart is not a wrong OTP

    def test_verify_unpaid_order(self):
        order_id = self.checkout()['id']
        res = self.verify(order_id, '123456')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.get_json()['reason'], 'not_paid')

    # -- shopping state --------------------------------------------------
    def patch_state(self, order_id, state, headers=CART_HEADERS, remote_addr='127.0.0.1'):
        return self.client.patch(f'/api/orders/{order_id}/shopping-state', json={'state': state},
                                 headers=headers, environ_base={'REMOTE_ADDR': remote_addr})

    def test_patch_shopping_state_completed(self):
        order_id = self.checkout()['id']
        self.assertEqual(self.patch_state(order_id, 'completed', headers={}).status_code, 401)
        self.assertEqual(self.patch_state(order_id, 'bogus').status_code, 400)
        self.assertEqual(self.patch_state(999999, 'picking').status_code, 404)
        self.assertEqual(self.patch_state(order_id, 'picking').get_json()['order']['shopping_state'], 'picking')

        before = datetime.now(timezone.utc)
        order = self.patch_state(order_id, 'completed').get_json()['order']
        self.assertEqual(order['shopping_state'], 'completed')
        self.assertEqual(order['status'], 'sent_to_cart')  # Order.status is never written
        self.assertLess(abs((_parse(order['pickup_eta']) - before).total_seconds()), 10)
        self.assertEqual(self.patch_state(order_id, 'waiting').status_code, 409)

        states = [e['state'] for e in self.client.get(f'/api/orders/{order_id}/events').get_json()]
        self.assertEqual(states[-2:], ['picking', 'completed'])

    def test_shopping_state_without_cart_key_is_localhost_only(self):
        order_id = self.checkout()['id']
        saved = os.environ.pop('CART_API_KEY')
        try:
            self.assertEqual(self.patch_state(order_id, 'picking', headers={}).status_code, 200)
            self.assertEqual(self.patch_state(order_id, 'completed', headers={}, remote_addr='192.168.1.50')
                             .status_code, 403)
            spoofed = self.patch_state(order_id, 'completed', headers={'X-Forwarded-For': '127.0.0.1'},
                                       remote_addr='192.168.1.50')
            self.assertEqual(spoofed.status_code, 403)
            # cart-only endpoints stay closed without a key
            self.assertEqual(self.verify(order_id, '123456', headers={}).status_code, 503)
            self.assertEqual(self.current_otp(headers={}).status_code, 503)
        finally:
            os.environ['CART_API_KEY'] = saved

    def test_mqtt_status_messages_update_shopping_state(self):
        order_id = self.checkout()['id']
        topic = 'cartmate/cart/CART_01/status'

        def send(state, cart='CART_01', **extra):
            payload = {'order_id': f'ORD_{order_id:04d}', 'cart_id': cart, 'state': state, 'seq': 1, **extra}
            return mqtt_service.handle_status_message(app, topic, json.dumps(payload).encode())

        def state():
            return self.client.get(f'/api/orders/{order_id}').get_json()['shopping_state']

        self.assertTrue(send('order_received'))
        self.assertEqual(state(), 'waiting')
        send('picking', item='Apple')
        self.assertEqual(state(), 'picking')
        self.assertFalse(send('picked', cart='CART_09'))  # wrong cart ignored
        send('pick_failed', item='Milk', detail='Not found on shelf')
        self.assertEqual(state(), 'needs_attention')
        send('picked', item='Apple')
        self.assertEqual(state(), 'needs_attention')
        send('order_done')
        order = self.client.get(f'/api/orders/{order_id}').get_json()
        self.assertEqual(order['shopping_state'], 'completed')
        self.assertEqual(order['status'], 'sent_to_cart')
        self.assertFalse(mqtt_service.handle_status_message(app, topic, b'not json'))


class OtpKeyTests(unittest.TestCase):
    def test_dev_key_generated_and_reused_when_env_missing(self):
        key_path = os.path.join(_TMP_DIR, 'dev_key_test', 'otp_dev.key')
        with mock.patch.dict(os.environ, {}, clear=False), \
                mock.patch.object(otp_service, 'DEV_KEY_PATH', key_path), \
                mock.patch.object(otp_service, '_fernet', None):
            os.environ.pop('OTP_ENC_KEY', None)
            token = otp_service.encrypt_otp('123456')
            self.assertTrue(os.path.isfile(key_path))
            otp_service._fernet = None  # simulate a restart: the saved key is reused
            self.assertEqual(otp_service.decrypt_otp(token), '123456')

    def test_wrong_key_raises_clear_error(self):
        token = Fernet(Fernet.generate_key()).encrypt(b'123456').decode()
        with self.assertRaises(otp_service.OtpDecryptError):
            otp_service.decrypt_otp(token)


class StatusSubscriberGuardTests(unittest.TestCase):
    def setUp(self):
        self._saved = (mqtt_service.MQTT_MODE, mqtt_service._status_subscriber_started, mqtt_service._status_client)
        mqtt_service.MQTT_MODE = 'real'
        mqtt_service._status_subscriber_started = False
        mqtt_service._status_client = None

    def tearDown(self):
        mqtt_service.MQTT_MODE, mqtt_service._status_subscriber_started, mqtt_service._status_client = self._saved
        os.environ.pop('WERKZEUG_RUN_MAIN', None)

    def test_starts_once_and_skips_reloader_parent(self):
        fake_client = mock.MagicMock()
        with mock.patch.object(mqtt_service, 'create_mqtt_client', return_value=fake_client) as factory:
            os.environ.pop('WERKZEUG_RUN_MAIN', None)
            self.assertIsNone(mqtt_service.start_status_subscriber(app, reloader_active=True))
            factory.assert_not_called()
            os.environ['WERKZEUG_RUN_MAIN'] = 'true'
            self.assertIs(mqtt_service.start_status_subscriber(app, reloader_active=True), fake_client)
            self.assertIs(mqtt_service.start_status_subscriber(app), fake_client)
            factory.assert_called_once()

    def test_broker_down_does_not_raise(self):
        with mock.patch.object(mqtt_service, 'create_mqtt_client', side_effect=OSError('broker down')):
            self.assertIsNone(mqtt_service.start_status_subscriber(app))


if __name__ == '__main__':
    unittest.main(verbosity=2)
