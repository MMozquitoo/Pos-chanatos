import { OrderStatus, VALID_STATUS_TRANSITIONS } from '../types';

/**
 * Valida si una transición de estado es permitida
 */
export function isValidStatusTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[from];
  return allowedTransitions.includes(to);
}

/**
 * Verifica si un pedido puede ser modificado
 * Un pedido pagado no puede modificarse
 */
export function canModifyOrder(paidAt: Date | null): boolean {
  return paidAt === null;
}

/**
 * Verifica si un pedido puede ser cancelado
 * Solo pedidos no pagados pueden cancelarse
 */
export function canCancelOrder(paidAt: Date | null): boolean {
  return paidAt === null;
}

