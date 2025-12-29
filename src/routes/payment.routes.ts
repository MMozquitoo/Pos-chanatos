import { Router } from "express";
import { PaymentController } from "../controllers/payment.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { Permission } from "../types";
import { body, param } from "express-validator";
import { PaymentMethod } from "@prisma/client";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * POST /payments
 * Crea un pago para un pedido
 * Permisos: solo CAJA (ORDER_MARK_PAID)
 */
router.post(
  "/",
  requirePermission(Permission.ORDER_MARK_PAID),
  [
    body("orderId").notEmpty().withMessage("Order ID is required"),
    body("method")
      .isIn(Object.values(PaymentMethod))
      .withMessage("Invalid payment method"),
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Amount must be greater than 0"),
    body("reference").optional().isString(),
    body("notes").optional().isString(),
  ],
  PaymentController.create
);

/**
 * GET /payments/order/:orderId
 * Obtiene todos los pagos de un pedido
 * Permisos: solo CAJA
 */
router.get(
  "/order/:orderId",
  requirePermission(Permission.ORDER_MARK_PAID),
  [param("orderId").notEmpty().withMessage("Order ID is required")],
  PaymentController.getOrderPayments
);

/**
 * GET /payments/order/:orderId/summary
 * Obtiene el resumen de pagos de un pedido
 * Permisos: CAJA, MESERO (no COCINA)
 * Nota: La validación de rol se hace en el servicio (PaymentService.getPaymentSummary)
 */
router.get(
  "/order/:orderId/summary",
  [param("orderId").notEmpty().withMessage("Order ID is required")],
  PaymentController.getPaymentSummary
);

export default router;
