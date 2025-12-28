import axios from 'axios';
import type { AuthResponse, Order, Table, KitchenOrder, Payment, CashSession, OrderItem, PaymentMethod } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token a todas las requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  getProfile: () => api.get('/auth/me'),
};

// Tables (Waiter)
export const tablesApi = {
  getTables: () => api.get<Table[]>('/waiter/tables'),
};

// Orders (Waiter)
export const waiterOrdersApi = {
  create: (data: { channel: string; tableId?: string; notes?: string; items: OrderItem[] }) =>
    api.post<Order>('/waiter/orders', data),
  list: (params?: { status?: string; channel?: string; readyOnly?: boolean }) =>
    api.get<Order[]>('/waiter/orders', { params }),
  getById: (id: string) => api.get<Order>(`/waiter/orders/${id}`),
  addItems: (id: string, items: OrderItem[]) =>
    api.post<Order>(`/waiter/orders/${id}/items`, { items }),
  deliver: (id: string) => api.post<Order>(`/waiter/orders/${id}/deliver`),
  requestBill: (id: string) => api.post<Order>(`/waiter/orders/${id}/request-bill`),
};

// Orders (Caja)
export const cajaOrdersApi = {
  list: (params?: { status?: string; channel?: string; requestedBill?: boolean }) =>
    api.get<Order[]>('/orders', { params }),
  getById: (id: string) => api.get<Order>(`/orders/${id}`),
};

// Payments (Caja)
export const paymentsApi = {
  create: (data: { orderId: string; method: PaymentMethod; amount: number; reference?: string; notes?: string }) =>
    api.post('/payments', data),
  getOrderPayments: (orderId: string) => api.get(`/payments/order/${orderId}`),
  getSummary: (orderId: string) => api.get(`/payments/order/${orderId}/summary`),
};

// Cash Sessions (Caja)
export const cashApi = {
  openSession: (data: { initialCash: number; notes?: string }) =>
    api.post<CashSession>('/cash/sessions', data),
  closeSession: (id: string, data: { finalCash: number; notes?: string }) =>
    api.post<CashSession>(`/cash/sessions/${id}/close`, data),
  getActive: () => api.get<CashSession>('/cash/sessions/active'),
  getSessions: () => api.get<CashSession[]>('/cash/sessions'),
};

// Kitchen
export const kitchenApi = {
  getQueue: () => api.get<KitchenOrder[]>('/kitchen/orders'),
  getOrder: (id: string) => api.get<KitchenOrder>(`/kitchen/orders/${id}`),
  startPreparation: (id: string) => api.post<KitchenOrder>(`/kitchen/orders/${id}/start`),
  markReady: (id: string) => api.post<KitchenOrder>(`/kitchen/orders/${id}/ready`),
};

export default api;

