import { initDB } from './db/db.js';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRoutes from './routes/user.routes.js';
import productRoutes from './routes/product.routes.js';

const app = express();
dotenv.config(); 

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE","OPTIONS"],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('/(.*)', cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use('/user', userRoutes);
app.use('/products', productRoutes);

try {
  console.log('Connecting to database...');
  await initDB();
  console.log('Database connected!');
  const PORT = process.env.PORT || 5000;
  app.listen(PORT,() => console.log(`Server running on port ${PORT}`));
} catch (err) {
  console.error('Startup error:', err);
  process.exit(1);
}