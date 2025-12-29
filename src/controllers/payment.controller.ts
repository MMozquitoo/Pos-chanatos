import { Response, NextFunction } from "express";
import { PaymentService, CreatePaymentData } from "../services/payment.service";
import { AuthRequest } from "../types";
import { validationResult } from "express-validator";

export class PaymentController {
  /**
   * POST /payments
   * Crea un pago para un pedido
   */
  static async create(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const data: CreatePaymentData = {
        orderId: req.body.orderId,
        method: req.body.method,
        amount: req.body.amount,
        reference: req.body.reference,
        notes: req.body.notes,
      };

      const result = await PaymentService.createPayment(
        req.user.id,
        data,
        req.user.role,
        req.ip,
        req.get("user-agent")
      );

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes("No permission") ||
          error.message.includes("Only CAJA")
        ) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes("No active cash session")) {
          res.status(400).json({ error: error.message });
          return;
        }
        if (
          error.message.includes("not found") ||
          error.message.includes("already paid") ||
          error.message.includes("exceeds order total") ||
          error.message.includes("must be greater")
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * GET /payments/order/:orderId
   * Obtiene todos los pagos de un pedido
   */
  static async getOrderPayments(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { orderId } = req.params;
      const result = await PaymentService.getOrderPayments(
        orderId,
        req.user.role
      );

      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only CAJA")) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message === "Order not found") {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * GET /payments/order/:orderId/summary
   * Obtiene el resumen de pagos de un pedido
   */
  static async getPaymentSummary(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { orderId } = req.params;
      const result = await PaymentService.getPaymentSummary(
        orderId,
        req.user.role
      );

      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("COCINA role cannot view")) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message === "Order not found") {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
}
