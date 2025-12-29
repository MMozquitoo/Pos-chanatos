import { prisma } from '../config/database';
import { OrderStatus, ChannelType, RoleType, Permission, ROLE_PERMISSIONS } from '../types';
import { AuditAction } from '@prisma/client';
import { isValidStatusTransition, canModifyOrder, canCancelOrder } from '../utils/order.utils';
import { AuditService } from './audit.service';

export interface CreateOrderData {
  channel: ChannelType;
  tableId?: string;
  notes?: string;
  items: CreateOrderItem[];
}

export interface CreateOrderItem {
  productName: string;
  quantity: number;
  price: number;
  notes?: string;
}

export interface UpdateOrderItemData {
  productName?: string;
  quantity?: number;
  price?: number;
  notes?: string;
}

export interface ChangeStatusData {
  newStatus: OrderStatus;
}

export interface CancelOrderData {
  reason: string;
}

export class OrderService {
  /**
   * Verifica si un rol tiene permiso para una acción
   */
  private static hasPermission(role: RoleType, permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    return rolePermissions.includes(permission);
  }
  
  /**
   * Verifica si un rol puede cambiar de un estado a otro
   */
  private static canChangeStatus(
    role: RoleType,
    from: OrderStatus,
    to: OrderStatus
  ): boolean {
    // CAJA puede cambiar a cualquier estado válido
    if (role === RoleType.CAJA) {
      return isValidStatusTransition(from, to);
    }
    
    // MESERO solo puede cambiar LISTO → ENTREGADO
    if (role === RoleType.MESERO) {
      return from === OrderStatus.LISTO && to === OrderStatus.ENTREGADO;
    }
    
    // COCINA puede cambiar RECIBIDO → PREPARACION y PREPARACION → LISTO
    if (role === RoleType.COCINA) {
      return (
        (from === OrderStatus.RECIBIDO && to === OrderStatus.PREPARACION) ||
        (from === OrderStatus.PREPARACION && to === OrderStatus.LISTO)
      );
    }
    
    return false;
  }
  
  /**
   * Crea un nuevo pedido
   */
  static async createOrder(
    userId: string,
    data: CreateOrderData,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Verificar permiso
    if (!this.hasPermission(userRole, Permission.ORDER_CREATE)) {
      throw new Error('No permission to create orders');
    }
    
    // Validar que si es MESA, tenga tableId
    if (data.channel === ChannelType.MESA && !data.tableId) {
      throw new Error('Table ID is required for MESA channel');
    }
    
    // Validar que si es MESA, la mesa no tenga una orden activa
    if (data.channel === ChannelType.MESA && data.tableId) {
      const activeOrder = await prisma.order.findFirst({
        where: {
          tableId: data.tableId,
          status: {
            notIn: [OrderStatus.ENTREGADO, OrderStatus.CANCELADO],
          },
          paidAt: null,
        },
      });
      
      if (activeOrder) {
        throw new Error('Table already has an active order');
      }
    }
    
    // Validar items
    if (!data.items || data.items.length === 0) {
      throw new Error('Order must have at least one item');
    }
    
    // Crear pedido con items
    const order = await prisma.order.create({
      data: {
        status: OrderStatus.RECIBIDO,
        channel: data.channel,
        tableId: data.tableId,
        notes: data.notes,
        userId,
        items: {
          create: data.items.map(item => ({
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: true,
        table: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    // Log de auditoría
    await AuditService.logOrderCreate(
      userId,
      order.id,
      data.channel,
      ipAddress,
      userAgent
    );
    
    return order;
  }
  
  /**
   * Obtiene un pedido por ID
   */
  static async getOrderById(orderId: string, userRole: RoleType) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        table: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        cancelLog: true,
      },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Cocina no puede ver precios
    if (userRole === RoleType.COCINA) {
      return {
        ...order,
        items: order.items.map(item => ({
          ...item,
          price: null, // Ocultar precio
        })),
      };
    }
    
    return order;
  }
  
  /**
   * Lista pedidos con filtros
   */
  static async listOrders(
    filters: {
      status?: OrderStatus;
      channel?: ChannelType;
      tableId?: string;
      userId?: string;
    },
    userRole: RoleType
  ) {
    const where: any = {};
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.channel) {
      where.channel = filters.channel;
    }
    
    if (filters.tableId) {
      where.tableId = filters.tableId;
    }
    
    if (filters.userId) {
      where.userId = filters.userId;
    }
    
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        table: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    // Cocina no puede ver precios
    if (userRole === RoleType.COCINA) {
      return orders.map(order => ({
        ...order,
        items: order.items.map(item => ({
          ...item,
          price: null,
        })),
      }));
    }
    
    return orders;
  }
  
  /**
   * Agrega items a un pedido existente
   */
  static async addItems(
    orderId: string,
    userId: string,
    items: CreateOrderItem[],
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Verificar permiso
    if (!this.hasPermission(userRole, Permission.ORDER_ADD_ITEMS)) {
      throw new Error('No permission to add items');
    }
    
    // Obtener pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Verificar que no esté pagado
    if (!canModifyOrder(order.paidAt)) {
      throw new Error('Cannot modify paid order');
    }
    
    // Verificar que no esté cancelado
    if (order.status === OrderStatus.CANCELADO) {
      throw new Error('Cannot add items to cancelled order');
    }
    
    // Agregar items
    const createdItems = await prisma.orderItem.createMany({
      data: items.map(item => ({
        orderId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes,
      })),
    });
    
    // Log de auditoría
    await AuditService.createLog({
      userId,
      orderId,
      action: AuditAction.UPDATE,
      details: `Added ${items.length} item(s) to order`,
      ipAddress,
      userAgent,
    });
    
    // Obtener pedido actualizado
    return this.getOrderById(orderId, userRole);
  }
  
  /**
   * Edita un item de pedido (solo CAJA)
   */
  static async editItem(
    orderId: string,
    itemId: string,
    userId: string,
    data: UpdateOrderItemData,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Verificar permiso
    if (!this.hasPermission(userRole, Permission.ORDER_EDIT_ITEMS)) {
      throw new Error('No permission to edit items');
    }
    
    // Obtener pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Verificar que no esté pagado
    if (!canModifyOrder(order.paidAt)) {
      throw new Error('Cannot modify paid order');
    }
    
    // Verificar que el item pertenezca al pedido
    const item = await prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId,
      },
    });
    
    if (!item) {
      throw new Error('Item not found in this order');
    }
    
    // Actualizar item
    const updatedItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        productName: data.productName,
        quantity: data.quantity,
        price: data.price,
        notes: data.notes,
      },
    });
    
    // Log de auditoría
    await AuditService.createLog({
      userId,
      orderId,
      action: AuditAction.UPDATE,
      details: `Edited item: ${item.productName}`,
      ipAddress,
      userAgent,
    });
    
    return updatedItem;
  }
  
  /**
   * Elimina un item de pedido (solo CAJA)
   */
  static async deleteItem(
    orderId: string,
    itemId: string,
    userId: string,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Verificar permiso
    if (!this.hasPermission(userRole, Permission.ORDER_DELETE_ITEMS)) {
      throw new Error('No permission to delete items');
    }
    
    // Obtener pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Verificar que no esté pagado
    if (!canModifyOrder(order.paidAt)) {
      throw new Error('Cannot modify paid order');
    }
    
    // Verificar que el item pertenezca al pedido
    const item = order.items.find(i => i.id === itemId);
    if (!item) {
      throw new Error('Item not found in this order');
    }
    
    // Verificar que no sea el último item
    if (order.items.length === 1) {
      throw new Error('Cannot delete the last item. Cancel the order instead.');
    }
    
    // Eliminar item
    await prisma.orderItem.delete({
      where: { id: itemId },
    });
    
    // Log de auditoría
    await AuditService.createLog({
      userId,
      orderId,
      action: AuditAction.DELETE,
      details: `Deleted item: ${item.productName}`,
      ipAddress,
      userAgent,
    });
  }
  
  /**
   * Cambia el estado de un pedido
   */
  static async changeStatus(
    orderId: string,
    userId: string,
    newStatus: OrderStatus,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Obtener pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Verificar que no esté pagado (excepto para cambios de estado normales)
    if (order.paidAt && newStatus !== OrderStatus.ENTREGADO) {
      throw new Error('Cannot change status of paid order');
    }
    
    // Verificar transición válida
    if (!isValidStatusTransition(order.status, newStatus)) {
      throw new Error(`Invalid status transition from ${order.status} to ${newStatus}`);
    }
    
    // Verificar permiso del rol
    if (!this.canChangeStatus(userRole, order.status, newStatus)) {
      throw new Error(`Role ${userRole} cannot change status from ${order.status} to ${newStatus}`);
    }
    
    // Actualizar estado
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: {
        items: true,
        table: true,
      },
    });
    
    // Log de auditoría
    await AuditService.logStatusChange(
      userId,
      orderId,
      order.status,
      newStatus,
      ipAddress,
      userAgent
    );
    
    return updatedOrder;
  }
  
  /**
   * Cancela un pedido (solo CAJA)
   */
  static async cancelOrder(
    orderId: string,
    userId: string,
    data: CancelOrderData,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Verificar permiso
    if (!this.hasPermission(userRole, Permission.ORDER_CANCEL)) {
      throw new Error('No permission to cancel orders');
    }
    
    // Obtener pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Verificar que no esté pagado
    if (!canCancelOrder(order.paidAt)) {
      throw new Error('Cannot cancel paid order');
    }
    
    // Verificar que no esté ya cancelado
    if (order.status === OrderStatus.CANCELADO) {
      throw new Error('Order is already cancelled');
    }
    
    // Validar motivo
    if (!data.reason || data.reason.trim().length === 0) {
      throw new Error('Cancellation reason is required');
    }
    
    // Actualizar estado y crear log de cancelación
    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELADO },
      }),
      prisma.cancelLog.create({
        data: {
          orderId,
          reason: data.reason,
          userId,
        },
      }),
    ]);
    
    // Log de auditoría
    await AuditService.logCancel(
      userId,
      orderId,
      data.reason,
      ipAddress,
      userAgent
    );
    
    return updatedOrder;
  }
  
  /**
   * Solicita cuenta (requested_bill = true)
   */
  static async requestBill(
    orderId: string,
    userId: string,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Verificar permiso
    if (!this.hasPermission(userRole, Permission.ORDER_REQUEST_BILL)) {
      throw new Error('No permission to request bill');
    }
    
    // Obtener pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Verificar que no esté pagado
    if (order.paidAt) {
      throw new Error('Order is already paid');
    }
    
    // Actualizar requestedBill
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { requestedBill: true },
      include: {
        items: true,
        table: true,
      },
    });
    
    // Log de auditoría
    await AuditService.createLog({
      userId,
      orderId,
      action: AuditAction.UPDATE,
      details: 'Bill requested',
      ipAddress,
      userAgent,
    });
    
    return updatedOrder;
  }
  
  /**
   * Calcula el total de un pedido
   */
  static async calculateTotal(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    const total = order.items.reduce((sum, item) => {
      return sum + Number(item.price) * item.quantity;
    }, 0);
    
    return {
      subtotal: total,
      total,
      itemsCount: order.items.length,
    };
  }
}

