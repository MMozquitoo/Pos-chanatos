import { Response, NextFunction } from 'express';
import { OrderService, CreateOrderData, CreateOrderItem, UpdateOrderItemData, ChangeStatusData, CancelOrderData } from '../services/order.service';
import { AuthRequest } from '../types';
import { validationResult } from 'express-validator';
import { OrderStatus, ChannelType } from '@prisma/client';

export class OrderController {
  /**
   * POST /orders
   * Crea un nuevo pedido
   */
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const data: CreateOrderData = {
        channel: req.body.channel,
        tableId: req.body.tableId,
        notes: req.body.notes,
        items: req.body.items,
      };
      
      const order = await OrderService.createOrder(
        req.user.id,
        data,
        req.user.role,
        req.ip,
        req.get('user-agent')
      );
      
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('permission') || error.message.includes('Table already has')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('required') || error.message.includes('must have')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
  
  /**
   * GET /orders/:id
   * Obtiene un pedido por ID
   */
  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const { id } = req.params;
      const order = await OrderService.getOrderById(id, req.user.role);
      
      res.json(order);
    } catch (error) {
      if (error instanceof Error && error.message === 'Order not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
  
  /**
   * GET /orders
   * Lista pedidos con filtros opcionales
   */
  static async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const filters: any = {};
      
      if (req.query.status) {
        filters.status = req.query.status;
      }
      
      if (req.query.channel) {
        filters.channel = req.query.channel;
      }
      
      if (req.query.tableId) {
        filters.tableId = req.query.tableId;
      }
      
      if (req.query.userId) {
        filters.userId = req.query.userId;
      }
      
      const orders = await OrderService.listOrders(filters, req.user.role);
      
      res.json(orders);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * POST /orders/:id/items
   * Agrega items a un pedido
   */
  static async addItems(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const { id } = req.params;
      const items: CreateOrderItem[] = req.body.items;
      
      const order = await OrderService.addItems(
        id,
        req.user.id,
        items,
        req.user.role,
        req.ip,
        req.get('user-agent')
      );
      
      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found') || error.message.includes('Cannot modify')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
  
  /**
   * PATCH /orders/:id/items/:itemId
   * Edita un item de pedido (solo CAJA)
   */
  static async editItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const { id, itemId } = req.params;
      const data: UpdateOrderItemData = {
        productName: req.body.productName,
        quantity: req.body.quantity,
        price: req.body.price,
        notes: req.body.notes,
      };
      
      const item = await OrderService.editItem(
        id,
        itemId,
        req.user.id,
        data,
        req.user.role,
        req.ip,
        req.get('user-agent')
      );
      
      res.json(item);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found') || error.message.includes('Cannot modify')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
  
  /**
   * DELETE /orders/:id/items/:itemId
   * Elimina un item de pedido (solo CAJA)
   */
  static async deleteItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const { id, itemId } = req.params;
      
      await OrderService.deleteItem(
        id,
        itemId,
        req.user.id,
        req.user.role,
        req.ip,
        req.get('user-agent')
      );
      
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found') || error.message.includes('Cannot')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
  
  /**
   * PATCH /orders/:id/status
   * Cambia el estado de un pedido
   */
  static async changeStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const { id } = req.params;
      const data: ChangeStatusData = {
        newStatus: req.body.status,
      };
      
      const order = await OrderService.changeStatus(
        id,
        req.user.id,
        data.newStatus,
        req.user.role,
        req.ip,
        req.get('user-agent')
      );
      
      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('permission') || error.message.includes('cannot change')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found') || error.message.includes('Invalid status')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
  
  /**
   * POST /orders/:id/cancel
   * Cancela un pedido (solo CAJA, requiere motivo)
   */
  static async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const { id } = req.params;
      const data: CancelOrderData = {
        reason: req.body.reason,
      };
      
      const order = await OrderService.cancelOrder(
        id,
        req.user.id,
        data,
        req.user.role,
        req.ip,
        req.get('user-agent')
      );
      
      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found') || error.message.includes('Cannot cancel') || error.message.includes('required')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
  
  /**
   * POST /orders/:id/request-bill
   * Solicita cuenta para un pedido
   */
  static async requestBill(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const { id } = req.params;
      
      const order = await OrderService.requestBill(
        id,
        req.user.id,
        req.user.role,
        req.ip,
        req.get('user-agent')
      );
      
      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found') || error.message.includes('already paid')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
  
  /**
   * GET /orders/:id/total
   * Calcula el total de un pedido
   */
  static async getTotal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      // Cocina no puede ver totales
      if (req.user.role === 'COCINA') {
        res.status(403).json({ error: 'No permission to view totals' });
        return;
      }
      
      const { id } = req.params;
      const total = await OrderService.calculateTotal(id);
      
      res.json(total);
    } catch (error) {
      if (error instanceof Error && error.message === 'Order not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
}

