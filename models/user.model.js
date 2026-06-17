import { DataTypes } from "sequelize";
import sequelize from "../db/db.js";

const User = sequelize.define('User', {
  
user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
password: {
    type: DataTypes.STRING,
    unique: false,
    allowNull: false
  },

}, );

export default User;