import { DataTypes } from "sequelize";
import sequelize from "../db/db.js";

const ProductImage = sequelize.define('ProductImage', {
  image_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Products',
      key: 'product_id'
    }
  },
  image_url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Display order in the carousel, 0-indexed'
  }
});

export default ProductImage;