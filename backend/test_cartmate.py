import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import app
from models import Shelf, Product
import json

def test_endpoints():
    with app.test_client() as client:
        # Test 1: GET /api/shelves
        print("\n=== Testing GET /api/shelves ===")
        res_shelves = client.get('/api/shelves')
        print(f"Status: {res_shelves.status_code}")
        print("Shelves data:", json.dumps(res_shelves.get_json(), indent=2))
        assert res_shelves.status_code == 200

        # Test 2: GET /api/products
        print("\n=== Testing GET /api/products ===")
        res_products = client.get('/api/products')
        print(f"Status: {res_products.status_code}")
        products_data = res_products.get_json()
        print(f"Products count: {len(products_data)}")
        for p in products_data:
            print(f"  Item #{p['id']}: {p['name']} (${p['price']}) -> Shelf {p.get('shelf_id')} ({p.get('shelf', {}).get('x_coord')}, {p.get('shelf', {}).get('y_coord')})")
        assert res_products.status_code == 200

        # Test 3: POST /api/orders/checkout with Apple (Shelf A), Milk (Shelf B), Soap (Shelf C), and Banana (Shelf A)
        print("\n=== Testing POST /api/orders/checkout ===")
        checkout_payload = {
            "cart_id": "CART_01",
            "product_ids": [1, 2, 3, 4]  # Apple (Shelf A), Milk (Shelf B), Soap (Shelf C), Banana (Shelf A)
        }
        res_checkout = client.post('/api/orders/checkout', json=checkout_payload)
        print(f"Checkout Status: {res_checkout.status_code}")
        checkout_data = res_checkout.get_json()
        print("Checkout Response:", json.dumps(checkout_data, indent=2))
        assert res_checkout.status_code == 200
        assert checkout_data["cart_id"] == "CART_01"
        # Waypoints are grouped per shelf SECTION: Apple (A/1) and Banana (A/2) are separate stops
        assert len(checkout_data["waypoints"]) == 4
        shelf_a_items = [w["items"] for w in checkout_data["waypoints"] if w["shelf_id"] == "SHELF_A"]
        print("Shelf A Waypoint items (per section):", shelf_a_items)
        assert ["Apple"] in shelf_a_items
        assert ["Banana"] in shelf_a_items
        print("\nAll backend CartMate tests PASSED successfully!")

if __name__ == '__main__':
    test_endpoints()
