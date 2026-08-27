import { DataTypes } from "sequelize";
import sequelize from "../db/db.js";

const Order = sequelize.define('Order', {
  order_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  mik_order_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'MIK Online order ID, used for idempotency'
  },
  status: {
    type: DataTypes.ENUM(
      'processing',
      'collecting',
      'collected',
      'centralwarehouse',
      'out for delivery',
      'delivered',
      'cancelled',
      'returned'
    ),
    allowNull: false,
    defaultValue: 'processing'
  },
  items_total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Sum of itemTotal across every item in the order'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Status update or cancellation reason sent by MIK'
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['mik_order_id']
    }
  ]
});

export default Order;
