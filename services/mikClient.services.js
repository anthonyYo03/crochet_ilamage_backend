/**
 * MIK Online API Client
 * Handles outbound communication: Your System → MIK Online
 * - OAuth2 token management (client_credentials)
 * - Product push / update / deactivate
 */

import { transformProductToMik } from './mikTransformer.js';
import Product from '../models/product.model.js';

const MIK_BASE_URL = 'https://webhook.mikonline.co/custom/v1';

// ── Token cache ──
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Clear cached token (e.g. on 401 Unauthorized response)
 */
export function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

/**
 * Obtain (or return cached) OAuth2 access token from MIK Online.
 */
export async function getAccessToken() {
  // Return cached token if still valid (with 60s safety margin)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = process.env.MIK_CLIENT_ID;
  const clientSecret = process.env.MIK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('MIK_CLIENT_ID and MIK_CLIENT_SECRET must be set in .env');
  }

  const response = await fetch(`${MIK_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`MIK OAuth token request failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  return cachedToken;
}

/**
 * Make an authenticated request to MIK Online with automatic 401 token refresh retry.
 */
async function mikRequest(method, path, body = null, isRetry = false) {
  const token = await getAccessToken();

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${MIK_BASE_URL}${path}`, options);

  // If token expired or was invalidated on MIK's end, retry once with a fresh token
  if (response.status === 401 && !isRetry) {
    console.warn('MIK request returned 401 Unauthorized. Refreshing token and retrying...');
    clearTokenCache();
    return mikRequest(method, path, body, true);
  }

  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `MIK API error (${method} ${path}) ${response.status}: ${JSON.stringify(responseData)}`
    );
  }

  return responseData;
}

/**
 * Push a new product to MIK Online (POST upsert).
 * @param {object} product - Sequelize Product instance (with images included) or plain object
 * @returns {object} MIK response data
 */
export async function pushProduct(product) {
  const payload = transformProductToMik(product);
  const result = await mikRequest('POST', '/products', payload);

  // Store the MIK internal product ID if returned
  if (result?.data?.productId) {
    try {
      await Product.update(
        { mik_product_id: result.data.productId },
        { where: { product_id: product.product_id } }
      );
    } catch (dbErr) {
      console.error('Failed to save mik_product_id to DB:', dbErr.message);
    }
  }

  return result;
}

/**
 * Update an existing product on MIK Online (PATCH upsert).
 * @param {object} product - Sequelize Product instance (with images included) or plain object
 * @returns {object} MIK response data
 */
export async function updateProduct(product) {
  const productId = String(product.product_id);
  const payload = transformProductToMik(product);
  const result = await mikRequest('PATCH', `/products/${productId}`, payload);

  // Store/update the MIK internal product ID if returned
  if (result?.data?.productId) {
    try {
      await Product.update(
        { mik_product_id: result.data.productId },
        { where: { product_id: product.product_id } }
      );
    } catch (dbErr) {
      console.error('Failed to save mik_product_id to DB:', dbErr.message);
    }
  }

  return result;
}

/**
 * Deactivate (soft-delete) a product on MIK Online.
 * @param {string|number} productId - Local product_id
 * @returns {object} MIK response data
 */
export async function deactivateProduct(productId) {
  return mikRequest('DELETE', `/products/${String(productId)}`);
}

export const mikClient = {
  getAccessToken,
  clearTokenCache,
  pushProduct,
  updateProduct,
  deactivateProduct
};

export default mikClient;
