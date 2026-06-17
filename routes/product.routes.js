import express from "express";
import {productController} from "../controllers/product.controller.js";
// import { verifyToken } from "../middlewares/auth.js";
// import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/getAll", productController.getAllProducts);
router.get("/getOne/:id", productController.getOneProduct);
router.post("/create", productController.createProduct);
router.put("/edit/:id", productController.editProduct);
router.delete("/delete/:id", productController.deleteProduct);

export default router;