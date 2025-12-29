import { Router } from "express";
import { OrderController } from "../controllers/order.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { Permission } from "../types";
import { body, param, query } from "express-validator";
import { OrderStatus, ChannelType } from "@prisma/client";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * POST /orders
 * Crea un nuevo pedido
 * Permisos: CAJA, MESERO
 */
router.post(
  "/",
  requirePermission(Permission.ORDER_CREATE),
  [
    body("channel")
      .isIn(Object.values(ChannelType))
      .withMessage("Invalid channel"),
    body("tableId").optional().isString(),
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
  OrderController.create
);

/**
 * GET /orders
 * Lista pedidos con filtros opcionales
 * Todos los roles autenticados pueden ver pedidos (con restricciones de precios para COCINA)
 */
router.get(
  "/",
  [
    query("status").optional().isIn(Object.values(OrderStatus)),
    query("channel").optional().isIn(Object.values(ChannelType)),
    query("tableId").optional().isString(),
    query("userId").optional().isString(),
  ],
  OrderController.list
);

/**
 * GET /orders/:id
 * Obtiene un pedido por ID
 */
router.get(
  "/:id",
  [param("id").notEmpty().withMessage("Order ID is required")],
  OrderController.getById
);

/**
 * POST /orders/:id/items
 * Agrega items a un pedido
 * Permisos: CAJA, MESERO
 */
router.post(
  "/:id/items",
  requirePermission(Permission.ORDER_ADD_ITEMS),
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
  OrderController.addItems
);

/**
 * PATCH /orders/:id/items/:itemId
 * Edita un item de pedido
 * Permisos: solo CAJA
 */
router.patch(
  "/:id/items/:itemId",
  requirePermission(Permission.ORDER_EDIT_ITEMS),
  [
    param("id").notEmpty().withMessage("Order ID is required"),
    param("itemId").notEmpty().withMessage("Item ID is required"),
    body("productName").optional().notEmpty(),
    body("quantity").optional().isInt({ min: 1 }),
    body("price").optional().isFloat({ min: 0 }),
    body("notes").optional().isString(),
  ],
  OrderController.editItem
);

/**
 * DELETE /orders/:id/items/:itemId
 * Elimina un item de pedido
 * Permisos: solo CAJA
 */
router.delete(
  "/:id/items/:itemId",
  requirePermission(Permission.ORDER_DELETE_ITEMS),
  [
    param("id").notEmpty().withMessage("Order ID is required"),
    param("itemId").notEmpty().withMessage("Item ID is required"),
  ],
  OrderController.deleteItem
);

/**
 * PATCH /orders/:id/status
 * Cambia el estado de un pedido
 * Permisos: según la transición (CAJA puede todo, MESERO solo LISTO→ENTREGADO, COCINA solo RECIBIDO→PREPARACION y PREPARACION→LISTO)
 * Nota: La validación de permisos se hace en el servicio, pero este endpoint está disponible para CAJA
 * MESERO y COCINA usan sus endpoints específicos (/waiter/orders/:id/deliver y /kitchen/orders/:id/start|ready)
 */
router.patch(
  "/:id/status",
  [
    param("id").notEmpty().withMessage("Order ID is required"),
    body("status")
      .isIn(Object.values(OrderStatus))
      .withMessage("Invalid status"),
  ],
  OrderController.changeStatus
);

/**
 * POST /orders/:id/cancel
 * Cancela un pedido (requiere motivo)
 * Permisos: solo CAJA
 */
router.post(
  "/:id/cancel",
  requirePermission(Permission.ORDER_CANCEL),
  [
    param("id").notEmpty().withMessage("Order ID is required"),
    body("reason")
      .notEmpty()
      .trim()
      .withMessage("Cancellation reason is required"),
  ],
  OrderController.cancel
);

/**
 * POST /orders/:id/request-bill
 * Solicita cuenta para un pedido
 * Permisos: CAJA, MESERO
 */
router.post(
  "/:id/request-bill",
  requirePermission(Permission.ORDER_REQUEST_BILL),
  [param("id").notEmpty().withMessage("Order ID is required")],
  OrderController.requestBill
);

/**
 * GET /orders/:id/total
 * Calcula el total de un pedido
 * Permisos: CAJA, MESERO (COCINA no puede ver)
 */
router.get(
  "/:id/total",
  [param("id").notEmpty().withMessage("Order ID is required")],
  OrderController.getTotal
);

export default router;
