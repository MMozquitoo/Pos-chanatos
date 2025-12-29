import { prisma } from "../config/database";
import { OrderStatus, RoleType } from "../types";
import { isValidStatusTransition } from "../utils/order.utils";
import { AuditService } from "./audit.service";

export interface KitchenOrderResponse {
  id: string;
  channel: string;
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

export class KitchenService {
  /**
   * Verifica que el rol sea COCINA
   */
  private static validateKitchenRole(userRole: RoleType): void {
    if (userRole !== RoleType.COCINA) {
      throw new Error("Only COCINA role can access kitchen endpoints");
    }
  }

  /**
   * Obtiene la cola de cocina (solo RECIBIDO y PREPARACION)
   * Ordenado por created_at ASC (más antiguos primero)
   */
  static async getKitchenQueue(
    userRole: RoleType
  ): Promise<KitchenOrderResponse[]> {
    this.validateKitchenRole(userRole);

    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.RECIBIDO, OrderStatus.PREPARACION],
        },
        // No incluir pedidos pagados (recomendado)
        paidAt: null,
      },
      include: {
        table: {
          select: {
            id: true,
            number: true,
          },
        },
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            notes: true,
            // NO incluir price
          },
        },
      },
      orderBy: {
        createdAt: "asc", // Cola por tiempo (más antiguos primero)
      },
    });

    // Transformar para asegurar que no se expongan precios
    return orders.map((order: (typeof orders)[0]) => ({
      id: order.id,
      channel: order.channel,
      table: order.table,
      status: order.status,
      createdAt: order.createdAt,
      notes: order.notes,
      items: order.items.map((item: (typeof order.items)[0]) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        notes: item.notes,
      })),
    }));
  }

  /**
   * Obtiene un pedido específico para cocina (sin precios)
   */
  static async getOrderById(
    orderId: string,
    userRole: RoleType
  ): Promise<KitchenOrderResponse> {
    this.validateKitchenRole(userRole);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: {
          select: {
            id: true,
            number: true,
          },
        },
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            notes: true,
            // NO incluir price
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
      createdAt: order.createdAt,
      notes: order.notes,
      items: order.items.map((item: (typeof order.items)[0]) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        notes: item.notes,
      })),
    };
  }

  /**
   * Inicia preparación: RECIBIDO -> PREPARACION
   * Con validación de concurrencia
   */
  static async startPreparation(
    orderId: string,
    userId: string,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ): Promise<KitchenOrderResponse> {
    this.validateKitchenRole(userRole);

    // Obtener pedido con lock para evitar concurrencia
    const order = await prisma.$transaction(async (tx: any) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      // Validar que no esté cancelado o entregado
      if (order.status === OrderStatus.CANCELADO) {
        throw new Error("Cannot start preparation for cancelled order");
      }

      if (order.status === OrderStatus.ENTREGADO) {
        throw new Error("Cannot start preparation for delivered order");
      }

      // Validar que no esté pagado (recomendado)
      if (order.paidAt) {
        throw new Error("Cannot start preparation for paid order");
      }

      // Validar estado actual
      if (order.status !== OrderStatus.RECIBIDO) {
        throw new Error(
          `Cannot start preparation. Current status is ${order.status}, expected RECIBIDO`
        );
      }

      // Validar transición
      if (
        !isValidStatusTransition(OrderStatus.RECIBIDO, OrderStatus.PREPARACION)
      ) {
        throw new Error(
          "Invalid status transition from RECIBIDO to PREPARACION"
        );
      }

      // Actualizar estado (con condición para evitar race condition)
      const updatedOrder = await tx.order.updateMany({
        where: {
          id: orderId,
          status: OrderStatus.RECIBIDO, // Solo actualizar si sigue en RECIBIDO
        },
        data: {
          status: OrderStatus.PREPARACION,
        },
      });

      if (updatedOrder.count === 0) {
        throw new Error("Order status changed. Please refresh and try again.");
      }

      // Obtener el pedido actualizado
      return await tx.order.findUnique({
        where: { id: orderId },
        include: {
          table: {
            select: {
              id: true,
              number: true,
            },
          },
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              notes: true,
            },
          },
        },
      });
    });

    if (!order) {
      throw new Error("Failed to update order");
    }

    // Log de auditoría
    await AuditService.logStatusChange(
      userId,
      orderId,
      OrderStatus.RECIBIDO,
      OrderStatus.PREPARACION,
      ipAddress,
      userAgent
    );

    return {
      id: order.id,
      channel: order.channel,
      table: order.table,
      status: order.status,
      createdAt: order.createdAt,
      notes: order.notes,
      items: order.items.map((item: (typeof order.items)[0]) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        notes: item.notes,
      })),
    };
  }

  /**
   * Marca como listo: PREPARACION -> LISTO
   * Con validación de concurrencia
   */
  static async markReady(
    orderId: string,
    userId: string,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ): Promise<KitchenOrderResponse> {
    this.validateKitchenRole(userRole);

    // Obtener pedido con lock para evitar concurrencia
    const order = await prisma.$transaction(async (tx: any) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      // Validar que no esté cancelado o entregado
      if (order.status === OrderStatus.CANCELADO) {
        throw new Error("Cannot mark ready for cancelled order");
      }

      if (order.status === OrderStatus.ENTREGADO) {
        throw new Error("Cannot mark ready for delivered order");
      }

      // Validar que no esté pagado (recomendado)
      if (order.paidAt) {
        throw new Error("Cannot mark ready for paid order");
      }

      // Validar estado actual
      if (order.status !== OrderStatus.PREPARACION) {
        throw new Error(
          `Cannot mark ready. Current status is ${order.status}, expected PREPARACION`
        );
      }

      // Validar transición
      if (
        !isValidStatusTransition(OrderStatus.PREPARACION, OrderStatus.LISTO)
      ) {
        throw new Error("Invalid status transition from PREPARACION to LISTO");
      }

      // Actualizar estado (con condición para evitar race condition)
      const updatedOrder = await tx.order.updateMany({
        where: {
          id: orderId,
          status: OrderStatus.PREPARACION, // Solo actualizar si sigue en PREPARACION
        },
        data: {
          status: OrderStatus.LISTO,
        },
      });

      if (updatedOrder.count === 0) {
        throw new Error("Order status changed. Please refresh and try again.");
      }

      // Obtener el pedido actualizado
      return await tx.order.findUnique({
        where: { id: orderId },
        include: {
          table: {
            select: {
              id: true,
              number: true,
            },
          },
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              notes: true,
            },
          },
        },
      });
    });

    if (!order) {
      throw new Error("Failed to update order");
    }

    // Log de auditoría
    await AuditService.logStatusChange(
      userId,
      orderId,
      OrderStatus.PREPARACION,
      OrderStatus.LISTO,
      ipAddress,
      userAgent
    );

    return {
      id: order.id,
      channel: order.channel,
      table: order.table,
      status: order.status,
      createdAt: order.createdAt,
      notes: order.notes,
      items: order.items.map((item: (typeof order.items)[0]) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        notes: item.notes,
      })),
    };
  }
}
