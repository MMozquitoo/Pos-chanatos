import { Response, NextFunction } from "express";
import { WaiterService, CreateOrderData, CreateOrderItem } from "../services/waiter.service";
import { AuthRequest } from "../types";
import { validationResult } from "express-validator";
import { OrderStatus, ChannelType } from "@prisma/client";

export class WaiterController {
  /**
   * GET /waiter/tables
   * Obtiene todas las mesas con estado de ocupación
   */
  static async getTables(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const tables = await WaiterService.getTables(req.user.role);

      res.json(tables);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only MESERO role")) {
          res.status(403).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * POST /waiter/orders
   * Crea un nuevo pedido
   */
  static async createOrder(
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

      const data: CreateOrderData = {
        channel: req.body.channel,
        tableId: req.body.tableId,
        notes: req.body.notes,
        items: req.body.items,
      };

      const order = await WaiterService.createOrder(
        req.user.id,
        data,
        req.user.role,
        req.ip,
        req.get("user-agent")
      );

      res.status(201).json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only MESERO role")) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (
          error.message.includes("Table already has") ||
          error.message.includes("required") ||
          error.message.includes("must have")
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * POST /waiter/orders/:id/items
   * Agrega items a un pedido
   */
  static async addItems(
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
      const items: CreateOrderItem[] = req.body.items;

      const order = await WaiterService.addItems(
        id,
        req.user.id,
        items,
        req.user.role,
        req.ip,
        req.get("user-agent")
      );

      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only MESERO role")) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (
          error.message.includes("not found") ||
          error.message.includes("Cannot modify") ||
          error.message.includes("Cannot add")
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * GET /waiter/orders
   * Lista pedidos con filtros opcionales
   */
  static async listOrders(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const filters: any = {};

      if (req.query.status) {
        filters.status = req.query.status;
      }

      if (req.query.channel) {
        filters.channel = req.query.channel;
      }

      // Filtro especial para LISTO
      if (req.query.readyOnly === "true" || req.query.readyOnly === "1") {
        filters.readyOnly = true;
      }

      const orders = await WaiterService.listOrders(filters, req.user.role);

      res.json(orders);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only MESERO role")) {
          res.status(403).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * GET /waiter/orders/:id
   * Obtiene un pedido por ID
   */
  static async getOrderById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { id } = req.params;
      const order = await WaiterService.getOrderById(id, req.user.role);

      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only MESERO role")) {
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
   * POST /waiter/orders/:id/deliver
   * Marca pedido como entregado: LISTO -> ENTREGADO
   */
  static async deliverOrder(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { id } = req.params;
      const order = await WaiterService.deliverOrder(
        id,
        req.user.id,
        req.user.role,
        req.ip,
        req.get("user-agent")
      );

      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only MESERO role")) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (
          error.message.includes("not found") ||
          error.message.includes("Cannot deliver") ||
          error.message.includes("Current status is")
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  /**
   * POST /waiter/orders/:id/request-bill
   * Solicita cuenta para un pedido
   */
  static async requestBill(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { id } = req.params;
      const order = await WaiterService.requestBill(
        id,
        req.user.id,
        req.user.role,
        req.ip,
        req.get("user-agent")
      );

      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Only MESERO role")) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (
          error.message.includes("not found") ||
          error.message.includes("already paid")
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
}

