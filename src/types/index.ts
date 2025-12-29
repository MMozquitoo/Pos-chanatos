// Tipos globales del sistema POS Chanatos

import { RoleType, OrderStatus, ChannelType, PaymentMethod, AuditAction } from '@prisma/client';

export { RoleType, OrderStatus, ChannelType, PaymentMethod, AuditAction };

// Tipos de autenticación
export interface JWTPayload {
  userId: string;
  email: string;
  role: RoleType;
}

export interface AuthRequest extends Express.Request {
  user?: {
    id: string;
    email: string;
    role: RoleType;
    name: string;
  };
}

// Permisos del sistema
export enum Permission {
  // Órdenes
  ORDER_CREATE = 'ORDER_CREATE',
  ORDER_ADD_ITEMS = 'ORDER_ADD_ITEMS',
  ORDER_EDIT_ITEMS = 'ORDER_EDIT_ITEMS',
  ORDER_DELETE_ITEMS = 'ORDER_DELETE_ITEMS',
  ORDER_CANCEL = 'ORDER_CANCEL',
  ORDER_REQUEST_BILL = 'ORDER_REQUEST_BILL',
  ORDER_MARK_PAID = 'ORDER_MARK_PAID',
  
  // Estados
  STATUS_RECIBIDO_TO_PREPARACION = 'STATUS_RECIBIDO_TO_PREPARACION',
  STATUS_PREPARACION_TO_LISTO = 'STATUS_PREPARACION_TO_LISTO',
  STATUS_LISTO_TO_ENTREGADO = 'STATUS_LISTO_TO_ENTREGADO',
  STATUS_TO_CANCELADO = 'STATUS_TO_CANCELADO',
  
  // Caja
  CASH_OPEN_SESSION = 'CASH_OPEN_SESSION',
  CASH_CLOSE_SESSION = 'CASH_CLOSE_SESSION',
  CASH_VIEW_REPORTS = 'CASH_VIEW_REPORTS',
  
  // Visualización
  VIEW_PRICES = 'VIEW_PRICES',
  VIEW_FINANCIAL_REPORTS = 'VIEW_FINANCIAL_REPORTS',
}

// Matriz de permisos por rol
export const ROLE_PERMISSIONS: Record<RoleType, Permission[]> = {
  CAJA: [
    // Todos los permisos de órdenes
    Permission.ORDER_CREATE,
    Permission.ORDER_ADD_ITEMS,
    Permission.ORDER_EDIT_ITEMS,
    Permission.ORDER_DELETE_ITEMS,
    Permission.ORDER_CANCEL,
    Permission.ORDER_REQUEST_BILL,
    Permission.ORDER_MARK_PAID,
    
    // Todos los cambios de estado
    Permission.STATUS_RECIBIDO_TO_PREPARACION,
    Permission.STATUS_PREPARACION_TO_LISTO,
    Permission.STATUS_LISTO_TO_ENTREGADO,
    Permission.STATUS_TO_CANCELADO,
    
    // Caja
    Permission.CASH_OPEN_SESSION,
    Permission.CASH_CLOSE_SESSION,
    Permission.CASH_VIEW_REPORTS,
    
    // Visualización
    Permission.VIEW_PRICES,
    Permission.VIEW_FINANCIAL_REPORTS,
  ],
  
  MESERO: [
    // Creación y agregar items
    Permission.ORDER_CREATE,
    Permission.ORDER_ADD_ITEMS,
    Permission.ORDER_REQUEST_BILL,
    
    // Solo puede cambiar LISTO → ENTREGADO
    Permission.STATUS_LISTO_TO_ENTREGADO,
    
    // Visualización básica
    Permission.VIEW_PRICES,
  ],
  
  COCINA: [
    // Solo cambios de estado de cocina
    Permission.STATUS_RECIBIDO_TO_PREPARACION,
    Permission.STATUS_PREPARACION_TO_LISTO,
    
    // NO puede ver precios ni reportes financieros
  ],
};

// Validación de transiciones de estado
export const VALID_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECIBIDO: ['PREPARACION', 'CANCELADO'],
  PREPARACION: ['LISTO', 'CANCELADO'],
  LISTO: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: [], // Estado final
  CANCELADO: [], // Estado final
};

