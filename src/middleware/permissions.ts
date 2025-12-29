import { Response, NextFunction } from 'express';
import { RoleType, Permission, ROLE_PERMISSIONS, AuthRequest } from '../types';

export const requirePermission = (permission: Permission) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    const userRole = req.user.role as RoleType;
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];
    
    if (!userPermissions.includes(permission)) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission,
        role: userRole,
      });
      return;
    }
    
    next();
  };
};

export const requireRole = (...allowedRoles: RoleType[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    const userRole = req.user.role as RoleType;
    
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ 
        error: 'Insufficient role',
        required: allowedRoles,
        current: userRole,
      });
      return;
    }
    
    next();
  };
};

