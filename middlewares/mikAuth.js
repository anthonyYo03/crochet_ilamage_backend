import jwt from 'jsonwebtoken';
import { secretKey } from './config.js';

/**
 * Middleware to authenticate incoming requests from MIK Online.
 * Supports both authentication methods described in MIK documentation:
 * 
 * Option A: Static API Key
 *   Authorization: Bearer YOUR_STATIC_API_KEY
 * 
 * Option B: OAuth Client Credentials Bearer Token
 *   Authorization: Bearer YOUR_ACCESS_TOKEN (JWT issued by /mikonline/v1/oauth/token)
 */
export const verifyMikAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid Authorization header'
    });
  }

  const token = authHeader.split(' ')[1];
  const expectedStaticKey = process.env.MIK_WEBHOOK_API_KEY;

  // 1. Check Option A: Static API Key match
  if (expectedStaticKey && token === expectedStaticKey) {
    req.mikAuth = { type: 'api_key' };
    return next();
  }

  // 2. Check Option B: OAuth Bearer JWT Token
  try {
    const decoded = jwt.verify(token, secretKey);
    if (decoded && (decoded.scope === 'mik_integration' || decoded.client_id)) {
      req.mikAuth = { type: 'oauth', ...decoded };
      return next();
    }
  } catch (jwtErr) {
    // JWT verification failed
  }

  // If both methods fail
  return res.status(401).json({
    success: false,
    message: 'Unauthorized: Invalid token or API key'
  });
};
