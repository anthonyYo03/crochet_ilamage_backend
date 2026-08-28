import dotenv from 'dotenv';
import express from 'express';
import { initDB } from './db/db.js';
import mikRoutes from './routes/mik.routes.js';
import Product from './models/product.model.js';
import ProductImage from './models/productImage.model.js';
import Order from './models/order.model.js';
import OrderItem from './models/orderItem.model.js';
import { transformProductToMik } from './services/mikTransformer.js';

dotenv.config();

async function runTests() {
  console.log('--- STARTING MIK INTEGRATION TEST SUITE ---');

  // Initialize DB
  await initDB();

  // Create Express App
  const app = express();
  app.use(express.json());
  app.use('/mikonline/v1', mikRoutes);

  const server = app.listen(5099);
  // const BASE_URL = 'http://127.0.0.1:5099/mikonline/v1';
  const BASE_URL=process.env.BASE_URL_RENDER;
  let testProduct = null;
  let testOrderId = `TEST-ORD-${Date.now()}`;
  let externalOrderId = null;
  let oauthToken = null;

  try {
    // ── TEST 1: Transformer Validation ──
    console.log('\n[TEST 1] Testing Product Transformer');
    const mockProduct = {
      product_id: 999,
      name: 'Handmade Crochet Bag',
      description: '100% organic cotton table runner',
      price: '45.00',
      discount_price: '38.00',
      quantity: 15,
      images: [
        { image_url: 'https://example.com/img1.jpg', position: 0 },
        { image_url: 'https://example.com/img2.jpg', position: 1 }
      ]
    };
    const transformed = transformProductToMik(mockProduct);
    if (transformed.id !== '999') throw new Error('Transformer id mismatch');
    if (transformed.cover !== 'https://example.com/img1.jpg') throw new Error('Transformer cover mismatch');
    if (transformed.variants[0].discountPrice !== 38) throw new Error('Transformer discountPrice mismatch');
    if (transformed.variants[0].quantity !== 15) throw new Error('Transformer quantity mismatch');
    if (transformed.images.length !== 2) throw new Error('Transformer images length mismatch');
    console.log('✓ Product Transformer conforms to MIK specifications');

    // ── TEST 2: Inbound OAuth Token Generation ──
    console.log('\n[TEST 2] Testing Inbound OAuth Token Generation (POST /oauth/token)');
    const oauthRes = await fetch(`${BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.MIK_CLIENT_ID,
        client_secret: process.env.MIK_CLIENT_SECRET
      })
    });
    if (oauthRes.status !== 200) throw new Error(`OAuth token generation failed with status ${oauthRes.status}`);
    const tokenData = await oauthRes.json();
    if (!tokenData.access_token || tokenData.token_type !== 'Bearer') throw new Error('Invalid token response structure');
    oauthToken = tokenData.access_token;
    console.log(`✓ OAuth token generated successfully: ${tokenData.token_type} (expires_in: ${tokenData.expires_in}s)`);

    // ── TEST 3: Webhook Auth Verification (Option A Static Key & Option B OAuth Token) ──
    console.log('\n[TEST 3] Testing Webhook Authentication Middleware');
    // 3a. Unauthorized without token
    const unauthRes = await fetch(`${BASE_URL}/products`);
    if (unauthRes.status !== 401) throw new Error(`Expected 401 for unauthenticated request, got ${unauthRes.status}`);
    console.log('✓ Rejected unauthenticated request with 401');

    // 3b. Authorized with Static API Key (Option A)
    const staticAuthRes = await fetch(`${BASE_URL}/products`, {
      headers: { 'Authorization': `Bearer ${process.env.MIK_WEBHOOK_API_KEY}` }
    });
    if (staticAuthRes.status !== 200) throw new Error(`Option A static key auth failed with status ${staticAuthRes.status}`);
    console.log('✓ Option A (Static API Key) authenticated successfully');

    // 3c. Authorized with OAuth Bearer Token (Option B)
    const oauthAuthRes = await fetch(`${BASE_URL}/products`, {
      headers: { 'Authorization': `Bearer ${oauthToken}` }
    });
    if (oauthAuthRes.status !== 200) throw new Error(`Option B OAuth token auth failed with status ${oauthAuthRes.status}`);
    console.log('✓ Option B (OAuth Bearer Token) authenticated successfully');

    // ── TEST 4: Create a Test Product in DB for Order Testing ──
    console.log('\n[TEST 4] Creating Test Product in DB');
    testProduct = await Product.create({
      name: 'MIK Test Crochet Scarf',
      category: 'Table Runners',
      description: 'Test crochet item for MIK verification',
      price: 25.00,
      height: 30,
      width: 120,
      quantity: 10,
      discount_price: 20.00,
      is_active: true
    });
    await ProductImage.create({
      product_id: testProduct.product_id,
      image_url: 'https://example.com/test-scarf.jpg',
      position: 0
    });
    console.log(`✓ Created test product ID: ${testProduct.product_id} with initial stock: ${testProduct.quantity}`);

    // ── TEST 5: GET /mikonline/v1/products ──
    console.log('\n[TEST 5] Testing GET /mikonline/v1/products');
    const getProductsRes = await fetch(`${BASE_URL}/products?page=1&limit=10`, {
      headers: { 'Authorization': `Bearer ${oauthToken}` }
    });
    const productsData = await getProductsRes.json();
    if (!productsData.success || !Array.isArray(productsData.products) || !productsData.pagination) {
      throw new Error('Invalid products list response format');
    }
    const found = productsData.products.find(p => p.id === String(testProduct.product_id));
    if (!found) throw new Error('Newly created test product was not returned in product list');
    console.log(`✓ GET /products returned ${productsData.products.length} products (total: ${productsData.pagination.total})`);

    // ── TEST 6: Receive Order & Inventory Decrement ──
    console.log('\n[TEST 6] Testing POST /mikonline/v1/orders (Receive New Order)');
    const orderPayload = {
      orderId: testOrderId,
      status: 'processing',
      itemsTotal: 43.50,
      items: [
        {
          externalProductId: String(testProduct.product_id),
          externalVariantId: String(testProduct.product_id),
          quantity: 2,
          price: 20.00,
          itemTotal: 43.50,
          customText: 'Gift for Sarah',
          customImageUrl: 'https://api.mikonline.co/uploads/custom_designs/test.webp',
          customMetadata: 'Custom stitch request',
          addons: [
            {
              externalGroupId: 'GIFT_BOX',
              externalOptionId: 'GIFT_BOX_WOODEN',
              groupLabel: 'Packaging',
              optionLabel: 'Wooden Box',
              price: 3.50
            }
          ]
        }
      ]
    };

    const orderRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oauthToken}`
      },
      body: JSON.stringify(orderPayload)
    });
    if (orderRes.status !== 201) throw new Error(`Receive order failed with status ${orderRes.status}`);
    const orderData = await orderRes.json();
    if (!orderData.success || !orderData.externalOrderId) throw new Error('Invalid receive order response structure');
    externalOrderId = orderData.externalOrderId;
    console.log(`✓ Order received successfully. Generated externalOrderId: ${externalOrderId}`);

    // Verify stock decrement
    const productAfterOrder = await Product.findByPk(testProduct.product_id);
    if (productAfterOrder.quantity !== 8) {
      throw new Error(`Expected product quantity to be 8 after ordering 2, but got ${productAfterOrder.quantity}`);
    }
    console.log(`✓ Product inventory correctly decremented from 10 to ${productAfterOrder.quantity}`);

    // ── TEST 7: Idempotency on Duplicate Order ──
    console.log('\n[TEST 7] Testing Order Idempotency (Duplicate POST /orders)');
    const duplicateRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oauthToken}`
      },
      body: JSON.stringify(orderPayload)
    });
    if (duplicateRes.status !== 201) throw new Error(`Idempotency check failed with status ${duplicateRes.status}`);
    const duplicateData = await duplicateRes.json();
    if (duplicateData.externalOrderId !== externalOrderId) {
      throw new Error(`Expected duplicate to return existing externalOrderId ${externalOrderId}, got ${duplicateData.externalOrderId}`);
    }
    // Verify inventory wasn't decremented again
    const productAfterDuplicate = await Product.findByPk(testProduct.product_id);
    if (productAfterDuplicate.quantity !== 8) {
      throw new Error(`Inventory was double-decremented! Quantity is ${productAfterDuplicate.quantity}`);
    }
    console.log('✓ Idempotency confirmed: returned existing externalOrderId and preserved stock level (8)');

    // ── TEST 8: Order Status Update & Inventory Restoration ──
    console.log(`\n[TEST 8] Testing PATCH /orders/${externalOrderId}/status (Cancellation & Stock Restore)`);
    const cancelRes = await fetch(`${BASE_URL}/orders/${externalOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oauthToken}`
      },
      body: JSON.stringify({
        status: 'cancelled',
        reason: 'Customer requested cancellation via MIK'
      })
    });
    if (cancelRes.status !== 200) throw new Error(`Order status update failed with status ${cancelRes.status}`);
    const cancelData = await cancelRes.json();
    if (!cancelData.success) throw new Error('Failed to update status');

    // Verify order in DB
    const cancelledOrder = await Order.findByPk(parseInt(externalOrderId, 10));
    if (cancelledOrder.status !== 'cancelled' || cancelledOrder.reason !== 'Customer requested cancellation via MIK') {
      throw new Error(`Order status/reason mismatch in DB: status=${cancelledOrder.status}, reason=${cancelledOrder.reason}`);
    }

    // Verify inventory restored
    const productAfterCancel = await Product.findByPk(testProduct.product_id);
    if (productAfterCancel.quantity !== 10) {
      throw new Error(`Expected product quantity to be restored to 10, got ${productAfterCancel.quantity}`);
    }
    console.log(`✓ Order cancelled successfully. Reason saved, inventory restored back to ${productAfterCancel.quantity}`);

    console.log('\n========================================');
    console.log('🎉 ALL MIK INTEGRATION TESTS PASSED 100%');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    // Cleanup test data
    if (testProduct) {
      try {
        await ProductImage.destroy({ where: { product_id: testProduct.product_id } });
        if (externalOrderId) {
          await OrderItem.destroy({ where: { order_id: parseInt(externalOrderId, 10) } });
          await Order.destroy({ where: { order_id: parseInt(externalOrderId, 10) } });
        }
        await Product.destroy({ where: { product_id: testProduct.product_id } });
        console.log('🧹 Cleaned up test data');
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }
    }
    server.close();
    process.exit(process.exitCode || 0);
  }
}

runTests();
