import { Router } from "express";
import { CashController } from "../controllers/cash.controller";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/permissions";
import { RoleType } from "../types";
import { body, param } from "express-validator";

const router = Router();

// Todas las rutas requieren autenticación y rol CAJA
router.use(authenticate);
router.use(requireRole(RoleType.CAJA));

/**
 * POST /cash/sessions
 * Abre una nueva sesión de caja
 */
router.post(
  "/sessions",
  [
    body("initialCash")
      .isFloat({ min: 0 })
      .withMessage("Initial cash must be a non-negative number"),
    body("notes").optional().isString(),
  ],
  CashController.openSession
);

/**
 * POST /cash/sessions/:id/close
 * Cierra una sesión de caja
 */
router.post(
  "/sessions/:id/close",
  [
    param("id").notEmpty().withMessage("Session ID is required"),
    body("finalCash")
      .isFloat({ min: 0 })
      .withMessage("Final cash must be a non-negative number"),
    body("notes").optional().isString(),
  ],
  CashController.closeSession
);

/**
 * GET /cash/sessions
 * Obtiene todas las sesiones de caja del usuario
 */
router.get("/sessions", CashController.getUserSessions);

/**
 * GET /cash/sessions/active
 * Obtiene la sesión activa del usuario
 */
router.get("/sessions/active", CashController.getActiveSession);

/**
 * GET /cash/sessions/:id
 * Obtiene una sesión por ID
 */
router.get(
  "/sessions/:id",
  [param("id").notEmpty().withMessage("Session ID is required")],
  CashController.getSessionById
);

export default router;
