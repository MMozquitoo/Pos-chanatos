import { Router } from "express";
import { KitchenController } from "../controllers/kitchen.controller";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/permissions";
import { RoleType } from "../types";
import { param } from "express-validator";

const router = Router();

// Todas las rutas requieren autenticación y rol COCINA
router.use(authenticate);
router.use(requireRole(RoleType.COCINA));

/**
 * GET /kitchen/orders
 * Obtiene la cola de cocina (solo RECIBIDO y PREPARACION)
 * Ordenado por created_at ASC
 */
router.get("/orders", KitchenController.getKitchenQueue);

/**
 * GET /kitchen/orders/:id
 * Obtiene un pedido específico para cocina
 */
router.get(
  "/orders/:id",
  [param("id").notEmpty().withMessage("Order ID is required")],
  KitchenController.getOrderById
);

/**
 * POST /kitchen/orders/:id/start
 * Inicia preparación: RECIBIDO -> PREPARACION
 */
router.post(
  "/orders/:id/start",
  [param("id").notEmpty().withMessage("Order ID is required")],
  KitchenController.startPreparation
);

/**
 * POST /kitchen/orders/:id/ready
 * Marca como listo: PREPARACION -> LISTO
 */
router.post(
  "/orders/:id/ready",
  [param("id").notEmpty().withMessage("Order ID is required")],
  KitchenController.markReady
);

export default router;
