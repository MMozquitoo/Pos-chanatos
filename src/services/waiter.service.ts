import { prisma } from "../config/database";
import { OrderStatus, ChannelType, RoleType } from "../types";
import { isValidStatusTransition, canModifyOrder } from "../utils/order.utils";
import { AuditService } from "./audit.service";
import { CreateOrderData, CreateOrderItem } from "./order.service";
import { AuditAction } from "@prisma/client";

export interface TableResponse {
  id: string;
  label: string;
  zone: string | null;
  is_active: boolean;
  is_occupied: boolean;
  active_order_id: string | null;
  active_order_status: OrderStatus | null;
  requested_bill: boolean | null;
}

export interface WaiterOrderResponse {
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
  notes: string | null;
  createdAt: Date;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    price: number;
    notes: string | null;
  }>;
}

export class WaiterService {
  /**
   * Verifica que el rol sea MESERO
   */
  private static validateWaiterRole(userRole: RoleType): void {
    if (userRole !== RoleType.MESERO) {
      throw new Error("Only MESERO role can access waiter endpoints");
    }
  }

  /**
   * Obtiene todas las mesas con su estado de ocupación
   */
  static async getTables(userRole: RoleType): Promise<TableResponse[]> {
    this.validateWaiterRole(userRole);

    const tables = await prisma.table.findMany({
      where: {
        active: true,
      },
      include: {
        orders: {
          where: {
            status: {
              notIn: [OrderStatus.ENTREGADO, OrderStatus.CANCELADO],
            },
            paidAt: null,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1, // Solo la orden activa más reciente
        },
      },
      orderBy: {
        number: "asc",
      },
    });

    return tables.map((table) => {
      const activeOrder = table.orders[0] || null;

      return {
        id: table.id,
        label: table.label || `Mesa ${table.number}`,
        zone: table.zone,
        is_active: table.active,
        is_occupied: activeOrder !== null,
        active_order_id: activeOrder?.id || null,
        active_order_status: activeOrder?.status || null,
        requested_bill: activeOrder?.requestedBill || null,
      };
    });
  }

  /**
   * Crea un nuevo pedido (MESERO)
   */
  static async createOrder(
    userId: string,
    data: CreateOrderData,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ): Promise<WaiterOrderResponse> {
    this.validateWaiterRole(userRole);

    // Validar que si es MESA, tenga tableId
    if (data.channel === ChannelType.MESA && !data.tableId) {
      throw new Error("Table ID is required for MESA channel");
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
        throw new Error("Table already has an active order");
      }
    }

    // Validar items
    if (!data.items || data.items.length === 0) {
      throw new Error("Order must have at least one item");
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
          create: data.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: true,
        table: {
          select: {
            id: true,
            number: true,
            label: true,
            zone: true,
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

    return {
      id: order.id,
      channel: order.channel,
      table: order.table,
      status: order.status,
      requestedBill: order.requestedBill,
      paidAt: order.paidAt,
      notes: order.notes,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        price: Number(item.price),
        notes: item.notes,
      })),
    };
  }

  /**
   * Agrega items a un pedido (solo agregar, NO editar ni borrar)
   */
  static async addItems(
    orderId: string,
    userId: string,
    items: CreateOrderItem[],
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ): Promise<WaiterOrderResponse> {
    this.validateWaiterRole(userRole);

    // Obtener pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    // Validar que no esté pagado
    if (!canModifyOrder(order.paidAt)) {
      throw new Error("Cannot modify paid order");
    }

    // Validar que no esté cancelado
    if (order.status === OrderStatus.CANCELADO) {
      throw new Error("Cannot add items to cancelled order");
    }

    // Agregar items
    await prisma.orderItem.createMany({
      data: items.map((item) => ({
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
   * Obtiene un pedido por ID
   */
  static async getOrderById(
    orderId: string,
    userRole: RoleType
  ): Promise<WaiterOrderResponse> {
    this.validateWaiterRole(userRole);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        table: {
          select: {
            id: true,
            number: true,
            label: true,
            zone: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    return {
      id: order.id,
      channel: order.channel,
      table: order.table,
      status: order.status,
      requestedBill: order.requestedBill,
      paidAt: order.paidAt,
      notes: order.notes,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        price: Number(item.price),
        notes: item.notes,
      })),
    };
  }

  /**
   * Lista pedidos con filtros
   */
  static async listOrders(
    filters: {
      status?: OrderStatus;
      channel?: ChannelType;
      readyOnly?: boolean; // Filtro especial para LISTO
    },
    userRole: RoleType
  ): Promise<WaiterOrderResponse[]> {
    this.validateWaiterRole(userRole);

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.channel) {
      where.channel = filters.channel;
    }

    // Filtro especial para LISTO
    if (filters.readyOnly) {
      where.status = OrderStatus.LISTO;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        table: {
          select: {
            id: true,
            number: true,
            label: true,
            zone: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return orders.map((order) => ({
      id: order.id,
      channel: order.channel,
      table: order.table,
      status: order.status,
      requestedBill: order.requestedBill,
      paidAt: order.paidAt,
      notes: order.notes,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        price: Number(item.price),
        notes: item.notes,
      })),
    }));
  }

  /**
   * Marca pedido como entregado: LISTO -> ENTREGADO
   */
  static async deliverOrder(
    orderId: string,
    userId: string,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ): Promise<WaiterOrderResponse> {
    this.validateWaiterRole(userRole);

    // Obtener pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    // Validar estado actual
    if (order.status !== OrderStatus.LISTO) {
      throw new Error(
        `Cannot deliver order. Current status is ${order.status}, expected LISTO`
      );
    }

    // Validar transición
    if (!isValidStatusTransition(OrderStatus.LISTO, OrderStatus.ENTREGADO)) {
      throw new Error("Invalid status transition from LISTO to ENTREGADO");
    }

    // Actualizar estado con protección de concurrencia
    const updatedOrder = await prisma.$transaction(async (tx: any) => {
      // Verificar estado actual dentro de la transacción
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!currentOrder) {
        throw new Error("Order not found");
      }

      if (currentOrder.status !== OrderStatus.LISTO) {
        throw new Error(
          `Order status changed. Current status is ${currentOrder.status}, expected LISTO`
        );
      }

      // Actualizar solo si sigue en LISTO
      const result = await tx.order.updateMany({
        where: {
          id: orderId,
          status: OrderStatus.LISTO, // Solo actualizar si sigue en LISTO
        },
        data: { status: OrderStatus.ENTREGADO },
      });

      if (result.count === 0) {
        throw new Error("Order status changed. Please refresh and try again.");
      }

      // Obtener el pedido actualizado
      return await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          table: {
            select: {
              id: true,
              number: true,
              label: true,
              zone: true,
            },
          },
        },
      });
    });

    // Log de auditoría
    await AuditService.logStatusChange(
      userId,
      orderId,
      OrderStatus.LISTO,
      OrderStatus.ENTREGADO,
      ipAddress,
      userAgent
    );

    return {
      id: updatedOrder.id,
      channel: updatedOrder.channel,
      table: updatedOrder.table,
      status: updatedOrder.status,
      requestedBill: updatedOrder.requestedBill,
      paidAt: updatedOrder.paidAt,
      notes: updatedOrder.notes,
      createdAt: updatedOrder.createdAt,
      items: updatedOrder.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        price: Number(item.price),
        notes: item.notes,
      })),
    };
  }

  /**
   * Solicita cuenta para un pedido
   */
  static async requestBill(
    orderId: string,
    userId: string,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ): Promise<WaiterOrderResponse> {
    this.validateWaiterRole(userRole);

    // Obtener pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    // Validar que no esté pagado
    if (order.paidAt) {
      throw new Error("Order is already paid");
    }

    // Actualizar requestedBill
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { requestedBill: true },
      include: {
        items: true,
        table: {
          select: {
            id: true,
            number: true,
            label: true,
            zone: true,
          },
        },
      },
    });

    // Log de auditoría
    await AuditService.createLog({
      userId,
      orderId,
      action: AuditAction.UPDATE,
      details: "Bill requested",
      ipAddress,
      userAgent,
    });

    return {
      id: updatedOrder.id,
      channel: updatedOrder.channel,
      table: updatedOrder.table,
      status: updatedOrder.status,
      requestedBill: updatedOrder.requestedBill,
      paidAt: updatedOrder.paidAt,
      notes: updatedOrder.notes,
      createdAt: updatedOrder.createdAt,
      items: updatedOrder.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        price: Number(item.price),
        notes: item.notes,
      })),
    };
  }
}
