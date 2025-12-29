import { prisma } from '../config/database';
import { AuditAction, OrderStatus } from '@prisma/client';

export interface CreateAuditLogParams {
  userId: string;
  orderId?: string;
  action: AuditAction;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  /**
   * Crea un log de auditoría
   */
  static async createLog(params: CreateAuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId,
          orderId: params.orderId,
          action: params.action,
          details: params.details,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      // No fallar si la auditoría falla, solo loggear
      console.error('Failed to create audit log:', error);
    }
  }
  
  /**
   * Crea un log de cambio de estado
   */
  static async logStatusChange(
    userId: string,
    orderId: string,
    from: OrderStatus,
    to: OrderStatus,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.createLog({
      userId,
      orderId,
      action: AuditAction.STATUS_CHANGE,
      details: `Status changed from ${from} to ${to}`,
      ipAddress,
      userAgent,
    });
  }
  
  /**
   * Crea un log de creación de pedido
   */
  static async logOrderCreate(
    userId: string,
    orderId: string,
    channel: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.createLog({
      userId,
      orderId,
      action: AuditAction.CREATE,
      details: `Order created with channel: ${channel}`,
      ipAddress,
      userAgent,
    });
  }
  
  /**
   * Crea un log de cancelación
   */
  static async logCancel(
    userId: string,
    orderId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.createLog({
      userId,
      orderId,
      action: AuditAction.CANCEL,
      details: `Order cancelled. Reason: ${reason}`,
      ipAddress,
      userAgent,
    });
  }
  
  /**
   * Crea un log de pago
   */
  static async logPayment(
    userId: string,
    orderId: string,
    amount: number,
    method: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.createLog({
      userId,
      orderId,
      action: AuditAction.PAYMENT,
      details: `Payment of ${amount} via ${method}`,
      ipAddress,
      userAgent,
    });
  }
  
  /**
   * Crea un log de apertura de caja
   */
  static async logCashOpen(
    userId: string,
    initialCash: number,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.createLog({
      userId,
      action: AuditAction.OTHER,
      details: `Cash session opened. Session ID: ${sessionId}, Initial cash: ${initialCash}`,
      ipAddress,
      userAgent,
    });
  }
  
  /**
   * Crea un log de cierre de caja
   */
  static async logCashClose(
    userId: string,
    finalCash: number,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.createLog({
      userId,
      action: AuditAction.OTHER,
      details: `Cash session closed. Session ID: ${sessionId}, Final cash: ${finalCash}`,
      ipAddress,
      userAgent,
    });
  }
}

