import { prisma } from '../config/database';
import { RoleType, Permission, ROLE_PERMISSIONS } from '../types';
import { PaymentMethod, OrderStatus } from '@prisma/client';
import { AuditService } from './audit.service';
import { AuditAction } from '@prisma/client';
import { CashService } from './cash.service';

export interface CreatePaymentData {
  orderId: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  notes?: string;
}

export class PaymentService {
  /**
   * Verifica si un rol tiene permiso para una acción
   */
  private static hasPermission(role: RoleType, permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    return rolePermissions.includes(permission);
  }
  
  /**
   * Calcula el total de un pedido
   */
  private static async calculateOrderTotal(orderId: string): Promise<number> {
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
    
    return total;
  }
  
  /**
   * Calcula el total pagado de un pedido
   */
  private static async calculatePaidTotal(orderId: string): Promise<number> {
    const payments = await prisma.payment.findMany({
      where: { orderId },
    });
    
    const total = payments.reduce((sum, payment) => {
      return sum + Number(payment.amount);
    }, 0);
    
    return total;
  }
  
  /**
   * Crea un pago para un pedido
   * Solo CAJA puede crear pagos
   * Requiere una sesión de caja abierta
   */
  static async createPayment(
    userId: string,
    data: CreatePaymentData,
    userRole: RoleType,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Verificar permiso
    if (!this.hasPermission(userRole, Permission.ORDER_MARK_PAID)) {
      throw new Error('No permission to create payments');
    }
    
    // Verificar que sea CAJA
    if (userRole !== RoleType.CAJA) {
      throw new Error('Only CAJA role can create payments');
    }
    
    // Verificar que haya una sesión de caja abierta
    const activeSession = await CashService.getAnyActiveSession();
    if (!activeSession) {
      throw new Error('No active cash session. Please open a cash session first.');
    }
    
    // Obtener pedido
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        items: true,
      },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Verificar que el pedido no esté cancelado
    if (order.status === OrderStatus.CANCELADO) {
      throw new Error('Cannot create payment for cancelled order');
    }
    
    // Verificar que el pedido no esté ya pagado
    if (order.paidAt) {
      throw new Error('Order is already paid');
    }
    
    // Validar monto
    if (data.amount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }
    
    // Calcular total del pedido y total pagado
    const orderTotal = await this.calculateOrderTotal(data.orderId);
    const paidTotal = await this.calculatePaidTotal(data.orderId);
    const newTotal = paidTotal + data.amount;
    
    // Validar que el nuevo total no exceda el total del pedido
    if (newTotal > orderTotal) {
      throw new Error(`Payment amount exceeds order total. Order total: ${orderTotal}, Already paid: ${paidTotal}, Attempted payment: ${data.amount}`);
    }
    
    // Crear pago
    const payment = await prisma.payment.create({
      data: {
        orderId: data.orderId,
        userId,
        cashSessionId: activeSession.id,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
      },
      include: {
        order: {
          include: {
            items: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        cashSession: {
          select: {
            id: true,
            openedAt: true,
          },
        },
      },
    });
    
    // Log de auditoría
    await AuditService.logPayment(
      userId,
      data.orderId,
      data.amount,
      data.method,
      ipAddress,
      userAgent
    );
    
    // Verificar si el pedido está completamente pagado
    const updatedPaidTotal = paidTotal + data.amount;
    
    // Usar tolerancia para comparación de decimales (0.01 centavos)
    const tolerance = 0.01;
    const difference = Math.abs(updatedPaidTotal - orderTotal);
    
    // Si sum(payments.amount) == total => set orders.paid_at = now()
    if (difference < tolerance) {
      // Marcar como pagado
      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          paidAt: new Date(),
        },
      });
      
      // Log de auditoría para mark_paid
      await AuditService.createLog({
        userId,
        orderId: data.orderId,
        action: AuditAction.PAYMENT,
        details: `Order marked as paid. Total: ${orderTotal}, Paid: ${updatedPaidTotal}`,
        ipAddress,
        userAgent,
      });
    }
    // Si sum(payments.amount) < total => permitir pagos parciales pero NO setear paid_at
    // (ya manejado, simplemente no marcamos como pagado)
    
    // Obtener el pedido actualizado para retornar
    const updatedOrder = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        items: true,
        payments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            cashSession: {
              select: {
                id: true,
                openedAt: true,
              },
            },
          },
        },
      },
    });
    
    return {
      payment,
      order: updatedOrder,
      total: orderTotal,
      paid: updatedPaidTotal,
      remaining: orderTotal - updatedPaidTotal,
      isPaid: updatedPaidTotal >= orderTotal,
    };
  }
  
  /**
   * Obtiene todos los pagos de un pedido
   */
  static async getOrderPayments(orderId: string, userRole: RoleType) {
    // Verificar que el pedido existe
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Solo CAJA puede ver pagos
    if (userRole !== RoleType.CAJA) {
      throw new Error('Only CAJA role can view payments');
    }
    
    const payments = await prisma.payment.findMany({
      where: { orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        cashSession: {
          select: {
            id: true,
            openedAt: true,
            closedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    
    const orderTotal = await this.calculateOrderTotal(orderId);
    const paidTotal = await this.calculatePaidTotal(orderId);
    
    return {
      payments,
      orderTotal,
      paidTotal,
      remaining: orderTotal - paidTotal,
      isPaid: order.paidAt !== null,
    };
  }
  
  /**
   * Obtiene el resumen de pagos de un pedido
   */
  static async getPaymentSummary(orderId: string, userRole: RoleType) {
    // Verificar que el pedido existe
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Cocina no puede ver información de pagos
    if (userRole === 'COCINA') {
      throw new Error('COCINA role cannot view payment information');
    }
    
    const orderTotal = await this.calculateOrderTotal(orderId);
    const paidTotal = await this.calculatePaidTotal(orderId);
    
    const payments = await prisma.payment.findMany({
      where: { orderId },
      select: {
        id: true,
        amount: true,
        method: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    
    return {
      orderId,
      orderTotal,
      paidTotal,
      remaining: orderTotal - paidTotal,
      isPaid: order.paidAt !== null,
      paidAt: order.paidAt,
      payments,
    };
  }
}

