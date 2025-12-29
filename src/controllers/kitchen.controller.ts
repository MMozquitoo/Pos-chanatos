import { Response, NextFunction } from "express";
import { KitchenService } from "../services/kitchen.service";
import { AuthRequest } from "../types";
import { param } from "express-validator";
import { validationResult } from "express-validator";

export class KitchenController {
  /**
   * GET /kitchen/orders
   * Obtiene la cola de cocina (solo RECIBIDO y PREPARACION)
   */
  static async getKitchenQueue(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const orders = await KitchenService.getKitchenQueue(req.user.role);

      res.json(orders);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only COCINA role")) {
          res.status(403).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * GET /kitchen/orders/:id
   * Obtiene un pedido específico para cocina
   */
  static async getOrderById(
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

      const { id } = req.params;
      const order = await KitchenService.getOrderById(id, req.user.role);

      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only COCINA role")) {
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
   * POST /kitchen/orders/:id/start
   * Inicia preparación: RECIBIDO -> PREPARACION
   */
  static async startPreparation(
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

      const { id } = req.params;
      const order = await KitchenService.startPreparation(
        id,
        req.user.id,
        req.user.role,
        req.ip,
        req.get("user-agent")
      );

      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only COCINA role")) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (
          error.message.includes("not found") ||
          error.message.includes("Cannot start") ||
          error.message.includes("Current status is") ||
          error.message.includes("status changed")
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * POST /kitchen/orders/:id/ready
   * Marca como listo: PREPARACION -> LISTO
   */
  static async markReady(
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

      const { id } = req.params;
      const order = await KitchenService.markReady(
        id,
        req.user.id,
        req.user.role,
        req.ip,
        req.get("user-agent")
      );

      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only COCINA role")) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (
          error.message.includes("not found") ||
          error.message.includes("Cannot mark") ||
          error.message.includes("Current status is") ||
          error.message.includes("status changed")
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
}
