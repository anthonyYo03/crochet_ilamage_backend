// config.js
const raw = process.env.SECRET_KEY;

if (!raw) {
  console.error('❌ FATAL ERROR: SECRET_KEY not found in environment');
  process.exit(1);
}

export const secretKey = raw; // ✅ Plain string, no template literal