import express from "express";
import { mikController } from "../controllers/mik.controller.js";
import { verifyMikAuth } from "../middlewares/mikAuth.js";

const router = express.Router();

// ── Inbound OAuth Token Generation (Public / Credential-based) ──
router.post("/oauth/token", mikController.generateOAuthToken);

// ── Authenticated Webhook Endpoints (Option A static key or Option B Bearer token) ──
router.use(verifyMikAuth);

// Fetch products list (initial sync / inventory reconciliation)
router.get("/products", mikController.getProducts);

// Receive new order from MIK
router.post("/orders", mikController.receiveOrder);

// Receive order status update from MIK
router.patch("/orders/:externalOrderId/status", mikController.updateOrderStatus);

export default router;
