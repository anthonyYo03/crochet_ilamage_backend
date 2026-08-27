/**
 * MIK Online Webhook Controller
 * Handles inbound requests: MIK Online → Your System
 *
 * Endpoints:
 *   POST  /mikonline/v1/oauth/token                    - Option B OAuth token exchange
 *   GET   /mikonline/v1/products                       - Fetch products list
 *   POST  /mikonline/v1/orders                         - Receive new order (with idempotency)
 *   PATCH /mikonline/v1/orders/:externalOrderId/status - Order status update
 */

import jwt from 'jsonwebtoken';
import { secretKey } from '../middlewares/config.js';
import Product from '../models/product.model.js';
import ProductImage from '../models/productImage.model.js';
import Order from '../models/order.model.js';
import OrderItem from '../models/orderItem.model.js';
import { Op } from 'sequelize';
import sequelize from '../db/db.js';
import { transformProductToMik } from '../services/mikTransformer.js';

const VALID_STATUSES = [
  'processing',
  'collecting',
  'collected',
  'centralwarehouse',
  'out for delivery',
  'delivered',
  'cancelled',
  'returned'
];

/**
 * POST /mikonline/v1/oauth/token
 * OAuth2 Client Credentials grant for MIK Online.
 */
export const generateOAuthToken = async (req, res) => {
  try {
    const { grant_type, client_id, client_secret } = req.body;

    if (grant_type !== 'client_credentials') {
      return res.status(400).json({
        success: false,
        message: 'Invalid grant_type. Must be "client_credentials"'
      });
    }

    const expectedClientId = process.env.MIK_INBOUND_CLIENT_ID || process.env.client_id;
    const expectedClientSecret = process.env.MIK_INBOUND_CLIENT_SECRET || process.env.MIK_CLIENT_SECRET;

    if (!client_id || !client_secret || client_id !== expectedClientId || client_secret !== expectedClientSecret) {
      return res.status(401).json({
        success: false,
        message: 'Invalid client credentials'
      });
    }

    const expiresInSeconds = 3600; // 1 hour
    const token = jwt.sign(
      {
        client_id,
        scope: 'mik_integration'
      },
      secretKey,
      { expiresIn: expiresInSeconds }
    );

    return res.status(200).json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: expiresInSeconds
    });
  } catch (error) {
    console.error('MIK generateOAuthToken error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate token' });
  }
};

/**
 * GET /mikonline/v1/products
 * Returns paginated product list in MIK's expected format.
 * Query params: page, limit, updatedAfter
 */
export const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 100, updatedAfter } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(500, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = { is_active: true };

    // Filter by updatedAfter if provided (ISO 8601 timestamp)
    if (updatedAfter) {
      const parsedDate = new Date(updatedAfter);
      if (!isNaN(parsedDate.getTime())) {
        where.updatedAt = { [Op.gt]: parsedDate };
      }
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [["createdAt", "DESC"]],
      include: [{
        model: ProductImage,
        as: 'images',
        attributes: ['image_id', 'image_url', 'position']
      }],
      distinct: true
    });

    const products = rows.map(transformProductToMik);

    res.status(200).json({
      success: true,
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count
      }
    });
  } catch (error) {
    console.error('MIK getProducts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
};

/**
 * Helper to resolve product ID from externalProductId
 */
function parseLocalProductId(externalId) {
  if (!externalId) return null;
  const directNum = parseInt(externalId, 10);
  if (!isNaN(directNum) && String(directNum) === String(externalId)) {
    return directNum;
  }
  const digitsOnly = String(externalId).replace(/\D/g, '');
  if (digitsOnly.length > 0) {
    const num = parseInt(digitsOnly, 10);
    if (!isNaN(num)) return num;
  }
  return null;
}

/**
 * POST /mikonline/v1/orders
 * Receives a new order from MIK Online.
 * Implements strict idempotency on mik_order_id.
 */
export const receiveOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { orderId, status, itemsTotal, items } = req.body;

    // Validate required fields
    if (!orderId || !items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: orderId, items'
      });
    }

    // Idempotency check: if this MIK order already exists, return the existing external order ID
    const existingOrder = await Order.findOne({
      where: { mik_order_id: String(orderId) },
      transaction
    });

    if (existingOrder) {
      await transaction.rollback();
      return res.status(201).json({
        success: true,
        externalOrderId: String(existingOrder.order_id)
      });
    }

    // Calculate or sanitize items total
    const totalAmount = itemsTotal != null
      ? parseFloat(itemsTotal)
      : items.reduce((sum, item) => sum + (parseFloat(item.itemTotal) || 0), 0);

    // Create the order
    const order = await Order.create({
      mik_order_id: String(orderId),
      status: status || 'processing',
      items_total: totalAmount
    }, { transaction });

    // Create order items and decrement stock
    for (const item of items) {
      const localId = parseLocalProductId(item.externalProductId);
      let product = null;

      if (localId != null) {
        product = await Product.findByPk(localId, { transaction });
      }

      const itemQuantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const itemPrice = parseFloat(item.price) || 0;
      const lineTotal = item.itemTotal != null ? parseFloat(item.itemTotal) : itemPrice * itemQuantity;

      await OrderItem.create({
        order_id: order.order_id,
        product_id: product ? product.product_id : null,
        external_product_id: String(item.externalProductId),
        external_variant_id: String(item.externalVariantId),
        quantity: itemQuantity,
        price: itemPrice,
        item_total: lineTotal,
        custom_text: item.customText || null,
        custom_image_url: item.customImageUrl || null,
        custom_metadata: item.customMetadata || null,
        addons: Array.isArray(item.addons) ? item.addons : []
      }, { transaction });

      // Decrement product stock if matched
      if (product) {
        const newQuantity = Math.max(0, product.quantity - itemQuantity);
        await product.update({ quantity: newQuantity }, { transaction });
      }
    }

    await transaction.commit();

    return res.status(201).json({
      success: true,
      externalOrderId: String(order.order_id)
    });
  } catch (error) {
    await transaction.rollback();
    console.error('MIK receiveOrder error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process order' });
  }
};

/**
 * PATCH /mikonline/v1/orders/:externalOrderId/status
 * Receives order status updates from MIK Online.
 */
export const updateOrderStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { externalOrderId } = req.params;
    const { status, reason } = req.body;

    if (!status) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Missing required field: status' });
    }

    if (!VALID_STATUSES.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
    }

    const orderIdNum = parseInt(externalOrderId, 10);
    if (isNaN(orderIdNum)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid externalOrderId' });
    }

    const order = await Order.findByPk(orderIdNum, {
      include: [{ model: OrderItem, as: 'items' }],
      transaction
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const previousStatus = order.status;

    // Update status and optional reason
    const updateData = { status };
    if (reason !== undefined) {
      updateData.reason = reason;
    }
    await order.update(updateData, { transaction });

    // If order was cancelled or returned from an active state, restore product stock
    const isCancelledOrReturned = status === 'cancelled' || status === 'returned';
    const wasActive = previousStatus !== 'cancelled' && previousStatus !== 'returned';

    if (isCancelledOrReturned && wasActive && order.items) {
      for (const item of order.items) {
        if (item.product_id) {
          const product = await Product.findByPk(item.product_id, { transaction });
          if (product) {
            await product.update({
              quantity: product.quantity + item.quantity
            }, { transaction });
          }
        }
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('MIK updateOrderStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
};

export const mikController = {
  generateOAuthToken,
  getProducts,
  receiveOrder,
  updateOrderStatus
};

export default mikController;
