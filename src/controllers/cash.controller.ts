import { Response, NextFunction } from 'express';
import { CashService, OpenCashSessionData, CloseCashSessionData } from '../services/cash.service';
import { AuthRequest } from '../types';
import { validationResult } from 'express-validator';

export class CashController {
  /**
   * POST /cash/sessions
   * Abre una nueva sesión de caja
   */
  static async openSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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
      
      const data: OpenCashSessionData = {
        initialCash: req.body.initialCash,
        notes: req.body.notes,
      };
      
      const session = await CashService.openSession(
        req.user.id,
        data,
        req.user.role,
        req.ip,
        req.get('user-agent')
      );
      
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Only CAJA') || error.message.includes('already has an active')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('cannot be negative')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
  
  /**
   * POST /cash/sessions/:id/close
   * Cierra una sesión de caja
   */
  static async closeSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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
      const data: CloseCashSessionData = {
        finalCash: req.body.finalCash,
        notes: req.body.notes,
      };
      
      const session = await CashService.closeSession(
        req.user.id,
        id,
        data,
        req.user.role,
        req.ip,
        req.get('user-agent')
      );
      
      res.json(session);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Only CAJA') || error.message.includes('Cannot close another')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found') || error.message.includes('already closed') || error.message.includes('cannot be negative')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
  
  /**
   * GET /cash/sessions
   * Obtiene todas las sesiones de caja del usuario
   */
  static async getUserSessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const sessions = await CashService.getUserSessions(req.user.id, req.user.role);
      
      res.json(sessions);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Only CAJA')) {
        res.status(403).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
  
  /**
   * GET /cash/sessions/active
   * Obtiene la sesión activa del usuario
   */
  static async getActiveSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const session = await CashService.getActiveSession(req.user.id);
      
      if (!session) {
        res.status(404).json({ error: 'No active cash session found' });
        return;
      }
      
      res.json(session);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * GET /cash/sessions/:id
   * Obtiene una sesión por ID
   */
  static async getSessionById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const { id } = req.params;
      const session = await CashService.getSessionById(id, req.user.role);
      
      res.json(session);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Only CAJA')) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message === 'Cash session not found') {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
}

