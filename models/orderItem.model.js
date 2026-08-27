import { DataTypes } from "sequelize";
import sequelize from "../db/db.js";
import Order from "./order.model.js";
import Product from "./product.model.js";

const OrderItem = sequelize.define('OrderItem', {
  order_item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Orders',
      key: 'order_id'
    }
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Products',
      key: 'product_id'
    }
  },
  external_product_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The product ID sent by MIK (matches our product_id as string)'
  },
  external_variant_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The variant ID sent by MIK'
  },
  // quantity: {
  //   type: DataTypes.INTEGER,
  //   allowNull: false
  // },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Unit price at purchase'
  },
  item_total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '(price + sum of addons price) × quantity'
  },
  custom_text: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Customer text customization'
  },
  custom_image_url: {
    type: DataTypes.STRING(2048),
    allowNull: true,
    comment: 'Customer design image URL'
  },
  custom_metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Additional metadata'
  },
  addons: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'Selected add-on options for this item'
  }
});

// ── ASSOCIATIONS ──
Order.hasMany(OrderItem, {
  foreignKey: 'order_id',
  as: 'items',
  onDelete: 'CASCADE'
});
OrderItem.belongsTo(Order, {
  foreignKey: 'order_id'
});
OrderItem.belongsTo(Product, {
  foreignKey: 'product_id'
});

export default OrderItem;
