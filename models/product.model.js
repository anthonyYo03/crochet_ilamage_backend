import { DataTypes } from "sequelize";
import sequelize from "../db/db.js";
import User from "./user.model.js";
import ProductImage from "./productImage.model.js";

const Product = sequelize.define('Product', {
    product_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    category: {
        type: DataTypes.ENUM('Table Runners', 'Bags', 'Baby Shower Collection', 'Keychain Collection', 'Christmas Collection'),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    height: {
        type: DataTypes.DECIMAL(10, 2), // Allows decimals like 120.50. Use INTEGER if they are always whole numbers.
        allowNull: false,
        comment: 'Height/Length in cm'
    },
    width: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Width in cm'
    },
    image_url: {
        type: DataTypes.STRING,
        allowNull: true // kept for backward compatibility, no longer required now that ProductImage handles multiple images
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Users',
            key: 'user_id'
        }
    }
});

// ── ASSOCIATION FOR MULTIPLE IMAGES ──
Product.hasMany(ProductImage, {
    foreignKey: 'product_id',
    as: 'images',
    onDelete: 'CASCADE'
});
ProductImage.belongsTo(Product, {
    foreignKey: 'product_id'
});

export default Product;