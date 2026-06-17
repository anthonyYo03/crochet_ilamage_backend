import {userController} from "../controllers/user.controller.js";
import express from 'express';
const router = express.Router();

router.post('/login', userController.loginUser);
router.post('/register', userController.registerUser);
export default router;