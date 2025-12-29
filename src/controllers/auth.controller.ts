import { Request, Response, NextFunction } from 'express';
import { AuthService, LoginCredentials, RegisterData } from '../services/auth.service';
import { AuthRequest } from '../types';
import { validationResult } from 'express-validator';

export class AuthController {
  /**
   * POST /auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      const credentials: LoginCredentials = {
        email: req.body.email,
        password: req.body.password,
      };
      
      const result = await AuthService.login(credentials);
      
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Invalid credentials' || error.message === 'User account is inactive') {
          res.status(401).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
  
  /**
   * POST /auth/register
   * Solo CAJA puede registrar usuarios en producción
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      
      const data: RegisterData = {
        email: req.body.email,
        password: req.body.password,
        name: req.body.name,
        roleId: req.body.roleId,
      };
      
      const result = await AuthService.register(data);
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Email already registered') {
          res.status(409).json({ error: error.message });
          return;
        }
        if (error.message === 'Invalid role') {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
  
  /**
   * GET /auth/me
   * Obtiene el perfil del usuario autenticado
   */
  static async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const profile = await AuthService.getProfile(req.user.id);
      
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }
}

