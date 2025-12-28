export type RoleType = "CAJA" | "MESERO" | "COCINA";
export type OrderStatus =
  | "RECIBIDO"
  | "PREPARACION"
  | "LISTO"
  | "ENTREGADO"
  | "CANCELADO";
export type ChannelType = "MESA" | "VENTANILLA" | "DOMICILIO";
export type PaymentMethod = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "OTRO";

export interface User {
  id: string;
  email: string;
  name: string;
  role: RoleType;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Table {
  id: string;
  label: string;
  zone: string | null;
  is_active: boolean;
  is_occupied: boolean;
  active_order_id: string | null;
  active_order_status: OrderStatus | null;
  requested_bill: boolean | null;
}

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  notes?: string | null;
}

export interface Order {
  id: string;
  channel: ChannelType;
  table?: {
    id: string;
    number: number;
    label: string | null;
    zone: string | null;
  } | null;
  status: OrderStatus;
  requestedBill: boolean;
  paidAt: Date | null;
  notes?: string | null;
  createdAt: Date;
  items: OrderItem[];
}

export interface KitchenOrder {
  id: string;
  channel: ChannelType;
  table?: {
    id: string;
    number: number;
  } | null;
  status: OrderStatus;
  createdAt: Date;
  notes?: string | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    notes?: string | null;
  }>;
}

export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  createdAt: Date;
}

export interface CashSession {
  id: string;
  openedAt: Date;
  closedAt: Date | null;
  initialCash: number;
  finalCash: number | null;
}
