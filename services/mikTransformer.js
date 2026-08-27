/**
 * MIK Product Transformer
 * Converts internal Product model instances into MIK Online payload specifications.
 */

export function transformProductToMik(product) {
  const productId = String(product.product_id);

  // Extract and sort images by position ascending
  const rawImages = product.images || [];
  const sortedImages = Array.isArray(rawImages)
    ? [...rawImages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : [];

  const images = sortedImages
    .filter(img => img && img.image_url)
    .map(img => ({ url: img.image_url }));

  // Fallback to legacy single image_url if images association is empty
  if (images.length === 0 && product.image_url) {
    images.push({ url: product.image_url });
  }

  // Cover image: first image in gallery or legacy image_url
  const cover = images.length > 0 ? images[0].url : (product.image_url || '');

  // Base price and quantity
  const price = Number(parseFloat(product.price || 0).toFixed(2));
  const quantity = Math.max(0, parseInt(product.quantity ?? 1, 10));

  // Build the primary variant
  const variant = {
    id: productId,
    quantity,
    price,
    group: 'Default',
    option: 'Default'
  };

  // Discount price must be strictly lower than price and > 0
  if (
    product.discount_price != null &&
    product.discount_price !== '' &&
    !isNaN(Number(product.discount_price))
  ) {
    const discount = Number(parseFloat(product.discount_price).toFixed(2));
    if (discount > 0 && discount < price) {
      variant.discountPrice = discount;
    }
  }

  return {
    id: productId,
    title: product.name || '',
    description: product.description || '',
    cover,
    customizable: false,
    customizationType: 'none',
    variants: [variant],
    images
  };
}
