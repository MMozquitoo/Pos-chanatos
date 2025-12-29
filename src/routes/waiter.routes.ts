import { Router } from "express";
import { WaiterController } from "../controllers/waiter.controller";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/permissions";
import { RoleType } from "../types";
import { body, param, query } from "express-validator";
import { OrderStatus, ChannelType } from "@prisma/client";

const router = Router();

// Todas las rutas requieren autenticación y rol MESERO
router.use(authenticate);
router.use(requireRole(RoleType.MESERO));

/**
 * GET /waiter/tables
 * Obtiene todas las mesas con estado de ocupación
 */
router.get("/tables", WaiterController.getTables);

/**
 * POST /waiter/orders
 * Crea un nuevo pedido
 */
router.post(
  "/orders",
  [
    body("channel")
      .isIn(Object.values(ChannelType))
      .withMessage("Invalid channel"),
    body("tableId")
      .optional()
      .custom((value, { req }) => {
        if (req.body.channel === ChannelType.MESA && !value) {
          throw new Error("Table ID is required for MESA channel");
        }
        return true;
      }),
    body("notes").optional().isString(),
    body("items")
      .isArray({ min: 1 })
      .withMessage("Items array is required with at least one item"),
    body("items.*.productName")
      .notEmpty()
      .withMessage("Product name is required"),
    body("items.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be at least 1"),
    body("items.*.price")
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number"),
    body("items.*.notes").optional().isString(),
  ],
  WaiterController.createOrder
);

/**
 * POST /waiter/orders/:id/items
 * Agrega items a un pedido (solo agregar, NO editar ni borrar)
 */
router.post(
  "/orders/:id/items",
  [
    param("id").notEmpty().withMessage("Order ID is required"),
    body("items")
      .isArray({ min: 1 })
      .withMessage("Items array is required with at least one item"),
    body("items.*.productName")
      .notEmpty()
      .withMessage("Product name is required"),
    body("items.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be at least 1"),
    body("items.*.price")
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number"),
    body("items.*.notes").optional().isString(),
  ],
  WaiterController.addItems
);

/**
 * GET /waiter/orders
 * Lista pedidos con filtros opcionales
 */
router.get(
  "/orders",
  [
    query("status").optional().isIn(Object.values(OrderStatus)),
    query("channel").optional().isIn(Object.values(ChannelType)),
    query("readyOnly").optional().isBoolean(),
  ],
  WaiterController.listOrders
);

/**
 * GET /waiter/orders/:id
 * Obtiene un pedido por ID
 */
router.get(
  "/orders/:id",
  [param("id").notEmpty().withMessage("Order ID is required")],
  WaiterController.getOrderById
);

/**
 * POST /waiter/orders/:id/deliver
 * Marca pedido como entregado: LISTO -> ENTREGADO
 */
router.post(
  "/orders/:id/deliver",
  [param("id").notEmpty().withMessage("Order ID is required")],
  WaiterController.deliverOrder
);

/**
 * POST /waiter/orders/:id/request-bill
 * Solicita cuenta para un pedido
 */
router.post(
  "/orders/:id/request-bill",
  [param("id").notEmpty().withMessage("Order ID is required")],
  WaiterController.requestBill
);

export default router;

