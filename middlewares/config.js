export const secretKey ='ecc7953bb87c02efdeed4baaaa9640efa2b9d93518eace55f9be56368fb5fd56';
if (!secretKey) {
  console.error('❌ FATAL ERROR: SECRET_KEY not found in .env file');
  process.exit(1); // Stop the server immediately
}