import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { body } from 'express-validator';

const router = Router();

/**
 * POST /auth/login
 * Autentica un usuario
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email must be valid'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  AuthController.login
);

/**
 * POST /auth/register
 * Registra un nuevo usuario (requiere autenticación CAJA)
 */
router.post(
  '/register',
  authenticate,
  [
    body('email').isEmail().withMessage('Email must be valid'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('roleId').notEmpty().withMessage('Role ID is required'),
  ],
  AuthController.register
);

/**
 * GET /auth/me
 * Obtiene el perfil del usuario autenticado
 */
router.get('/me', authenticate, AuthController.getProfile);

export default router;

