import { Router } from "express";
import authRoutes from "./auth.routes";
import orderRoutes from "./order.routes";
import cashRoutes from "./cash.routes";
import paymentRoutes from "./payment.routes";
import kitchenRoutes from "./kitchen.routes";
import waiterRoutes from "./waiter.routes";

const router = Router();

// Health check
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
router.use("/auth", authRoutes);
router.use("/orders", orderRoutes);
router.use("/cash", cashRoutes);
router.use("/payments", paymentRoutes);
router.use("/kitchen", kitchenRoutes);
router.use("/waiter", waiterRoutes);

// TODO: Agregar más rutas aquí
// router.use('/tables', tableRoutes);

export default router;
