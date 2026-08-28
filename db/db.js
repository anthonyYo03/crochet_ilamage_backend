import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 1,
    idle: 30000,
    acquire: 30000
  }
});
export async function initDB() {
  await import('../models/user.model.js');
  await import('../models/product.model.js');
 

  await sequelize.authenticate();
  console.log('Connection established successfully.');

  await sequelize.sync({ alter: true });
  console.log('Tables created/synced');
}

export default sequelize;