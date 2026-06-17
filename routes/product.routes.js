import express from "express";
import {productController} from "../controllers/product.controller.js";
import { verifyToken } from "../middlewares/auth.js";

const router = express.Router();

router.get("/getAll", productController.getAllProducts);
router.get("/getOne/:id", productController.getOneProduct);
router.post("/create", verifyToken, productController.createProduct);
router.put("/edit/:id", verifyToken, productController.editProduct);
router.delete("/delete/:id", verifyToken, productController.deleteProduct);

export default router;