import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JWTPayload, AuthRequest } from '../types';
import { prisma } from '../config/database';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
      
      // Verificar que el usuario existe y está activo
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { role: true },
      });
      
      if (!user || !user.active) {
        res.status(401).json({ error: 'User not found or inactive' });
        return;
      }
      
      // Agregar usuario al request
      (req as AuthRequest).user = {
        id: user.id,
        email: user.email,
        role: user.role.name,
        name: user.name,
      };
      
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

