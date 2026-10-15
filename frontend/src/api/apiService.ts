import axios from 'axios';
import { Platform } from 'react-native';

// IMPORTANT: If testing on a physical phone via Expo Go, replace 127.0.0.1
// with your computer's local IP address (e.g., 'http://192.168.1.X:5000')
export const API_BASE_URL = 'http://127.0.0.1:5000';

// ---------------------------------------------------------------------------
// JWT token management — stored in memory (no async-storage dependency)
// ---------------------------------------------------------------------------
let _authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  _authToken = token;
};

export const getAuthToken = (): string | null => _authToken;

// ---------------------------------------------------------------------------
// Axios instance — attaches JWT to every request if available
// ---------------------------------------------------------------------------
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  if (_authToken) {
    config.headers.Authorization = `Bearer ${_authToken}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ShelfSection {
  id: number | null;
  shelf_id: string;
  section_number: number;  // 1 to 5
  x_coord: number;
  y_coord: number;
  orientation_theta: number;
}

export interface Shelf {
  id: string;             // e.g. 'SHELF_A', 'SHELF_B', 'SHELF_C'
  name: string;           // e.g. 'Shelf A - Fruits & Vegetables'
  x_coord: number;        // Map X coordinate in meters
  y_coord: number;        // Map Y coordinate in meters
  orientation_theta?: number; // Heading angle in degrees
  total_sections?: number;
  product_count?: number;
  sections?: ShelfSection[];  // Per-section navigation coordinates
  products?: {
    id: number;
    name: string;
    price: number;
    stock?: number;
    shelf_id?: string | null;
    shelf_section?: number;
    image_url?: string | null;
  }[];
}

export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  shelf_id?: string | null;
  shelf_section?: number | null;
  shelf?: Shelf | null;
  description?: string | null;
  image_url?: string | null;
}

export interface NavigationWaypoint {
  shelf_id: string;
  shelf_coords?: {
    x: number;
    y: number;
    orientation_theta: number;
  };
  section: number;         // Section number (1-5)
  section_coords?: {
    x: number;
    y: number;
    orientation_theta: number;
  };
  x: number;
  y: number;
  orientation_theta: number;
  items: string[];
}

export interface CheckoutResponse {
  status: string;
  order_id: string;
  cart_id: string;
  created_at: string;
  waypoints: NavigationWaypoint[];
  total_amount: number;
  mqtt_topic: string;
  mqtt_published: boolean;
  mqtt_mode: string;
  message: string;
  warning?: string;
}

export interface ProductPayload {
  name: string;
  price: number | string;
  stock: number | string;
  shelf_id?: string | null;
  shelf_section?: number | string | null;
  description?: string | null;
  imageUri?: string | null;
  imageName?: string | null;
  imageType?: string | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  product_image_url?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: number;
  user_id: number;
  status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  mqtt_status: string;
  mqtt_message_id: string | null;
  item_count: number;
  items?: OrderItem[];
  user_email?: string;        // Admin view only
}

export interface SubmitOrderResponse {
  order: Order;
  mqtt_published: boolean;
  mqtt_warning?: string;
}

export interface CreateOrderPayload {
  items: { product_id: number; quantity: number }[];
}

interface ApiErrorResponse {
  msg?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export const getImageUrl = (imagePath: string | null | undefined): string | null => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_BASE_URL}${path}`;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    if (error.response?.data?.msg) return error.response.data.msg;
    if (error.response?.data?.message) return error.response.data.message;
    if (error.code === 'ERR_NETWORK') {
      return 'Cannot connect to backend server. Ensure Flask is running.';
    }
    if (error.code === 'ECONNABORTED') return 'Request timed out. Check your server connection.';
    if (error.message) return error.message;
  }
  return fallback;
};

const appendImageToFormData = async (formData: FormData, productData: ProductPayload) => {
  if (!productData.imageUri) return;
  const fileName = productData.imageName || 'product.jpg';
  const mimeType = productData.imageType || 'image/jpeg';
  if (Platform.OS === 'web') {
    const response = await fetch(productData.imageUri);
    const blob = await response.blob();
    formData.append('image', blob, fileName);
    return;
  }
  formData.append('image', {
    uri: productData.imageUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const loginUser = async (email: string, password: string) => {
  try {
    const response = await api.post('/api/login', { email, password });
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Network error while logging in.');
  }
};

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export const fetchProducts = async (): Promise<Product[]> => {
  try {
    const response = await api.get('/api/products');
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to fetch catalog.');
  }
};

export const addProduct = async (productData: ProductPayload) => {
  try {
    const formData = new FormData();
    formData.append('name', String(productData.name));
    formData.append('price', String(productData.price));
    formData.append('stock', String(productData.stock));
    if (productData.shelf_id) {
      formData.append('shelf_id', productData.shelf_id);
    }
    if (productData.shelf_section) {
      formData.append('shelf_section', String(productData.shelf_section));
    }
    if (productData.description?.trim()) {
      formData.append('description', productData.description.trim());
    }
    await appendImageToFormData(formData, productData);
    const response = await axios.post(`${API_BASE_URL}/api/products`, formData, {
      headers: { 'Content-Type': 'multipart/form-data', Authorization: _authToken ? `Bearer ${_authToken}` : '' },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to add product.');
  }
};

export const deleteProduct = async (productId: number) => {
  try {
    const response = await api.delete(`/api/products/${productId}`);
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to delete product.');
  }
};

// ---------------------------------------------------------------------------
// Orders — Customer
// ---------------------------------------------------------------------------
export const createOrder = async (payload: CreateOrderPayload): Promise<Order> => {
  try {
    const response = await api.post('/api/orders', payload);
    return response.data.order;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to create order.');
  }
};

export const submitOrder = async (orderId: number): Promise<SubmitOrderResponse> => {
  try {
    const response = await api.post(`/api/orders/${orderId}/submit`);
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to submit order.');
  }
};

export const fetchOrders = async (): Promise<Order[]> => {
  try {
    const response = await api.get('/api/orders');
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to fetch orders.');
  }
};

export const fetchOrder = async (orderId: number): Promise<Order> => {
  try {
    const response = await api.get(`/api/orders/${orderId}`);
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to fetch order.');
  }
};

export const updateOrderItem = async (
  orderId: number,
  itemId: number,
  quantity: number
): Promise<Order> => {
  try {
    const response = await api.patch(`/api/orders/${orderId}/items/${itemId}`, { quantity });
    return response.data.order;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to update item.');
  }
};

export const deleteOrderItem = async (orderId: number, itemId: number): Promise<Order> => {
  try {
    const response = await api.delete(`/api/orders/${orderId}/items/${itemId}`);
    return response.data.order;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to remove item.');
  }
};

// ---------------------------------------------------------------------------
// Orders — Admin
// ---------------------------------------------------------------------------
export const fetchAdminOrders = async (): Promise<Order[]> => {
  try {
    const response = await api.get('/api/admin/orders');
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to fetch admin orders.');
  }
};

// ---------------------------------------------------------------------------
// CartMate Autonomous Navigation & Shelves
// ---------------------------------------------------------------------------
export const fetchShelves = async (includeProducts: boolean = true): Promise<Shelf[]> => {
  try {
    const response = await api.get(`/api/shelves?include_products=${includeProducts}`);
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to fetch supermarket shelves.');
  }
};

export const createShelf = async (shelfData: {
  id: string;
  name: string;
  x_coord: number;
  y_coord: number;
  orientation_theta?: number;
}): Promise<{ msg: string; shelf: Shelf }> => {
  try {
    const response = await api.post('/api/shelves', shelfData);
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to create shelf.');
  }
};

export const updateShelf = async (
  shelfId: string,
  shelfData: Partial<{
    name: string;
    x_coord: number;
    y_coord: number;
    orientation_theta: number;
  }>
): Promise<{ msg: string; shelf: Shelf }> => {
  try {
    const response = await api.put(`/api/shelves/${shelfId}`, shelfData);
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to update shelf.');
  }
};

export const deleteShelf = async (shelfId: string): Promise<{ msg: string }> => {
  try {
    const response = await api.delete(`/api/shelves/${shelfId}`);
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to delete shelf.');
  }
};

export const assignProductShelf = async (
  productId: number,
  shelfId: string | null,
  shelfSection?: number | null
): Promise<{ msg: string; product: Product }> => {
  try {
    const response = await api.patch(`/api/products/${productId}/shelf`, {
      shelf_id: shelfId,
      shelf_section: shelfSection ?? (shelfId ? 1 : null),
    });
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to assign product to shelf.');
  }
};

export const updateProduct = async (
  productId: number,
  updates: Partial<ProductPayload>
): Promise<{ msg: string; product: Product }> => {
  try {
    const response = await api.patch(`/api/products/${productId}`, updates);
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to update product details.');
  }
};

export const checkoutOrder = async (
  productIds: number[],
  cartId: string = 'CART_01'
): Promise<CheckoutResponse> => {
  try {
    const response = await api.post('/api/orders/checkout', {
      product_ids: productIds,
      cart_id: cartId,
    });
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to checkout and start cart navigation.');
  }
};

// ---------------------------------------------------------------------------
// Shelf Section Coordinate Management
// ---------------------------------------------------------------------------
export const fetchShelfSections = async (shelfId: string): Promise<ShelfSection[]> => {
  try {
    const response = await api.get(`/api/shelves/${shelfId}/sections`);
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to fetch shelf section coordinates.');
  }
};

export const updateShelfSection = async (
  shelfId: string,
  sectionNumber: number,
  coords: { x_coord: number; y_coord: number; orientation_theta?: number }
): Promise<{ msg: string; sections: ShelfSection[] }> => {
  try {
    const response = await api.put(`/api/shelves/${shelfId}/sections/${sectionNumber}`, {
      x_coord: coords.x_coord,
      y_coord: coords.y_coord,
      orientation_theta: coords.orientation_theta ?? 0,
    });
    return response.data;
  } catch (error) {
    throw getErrorMessage(error, 'Failed to update shelf section coordinates.');
  }
};
