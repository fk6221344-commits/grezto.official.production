/**
 * Phase 4: Schema Sanitization & Anti-Injection Layer (Pure Data Enforcement)
 * Validates and whitelists incoming productData payloads to block extra keys or malicious injections.
 */
export function sanitizeProductPayload(rawProduct: any): any {
  if (!rawProduct || typeof rawProduct !== 'object') {
    return {};
  }

  // Pure Whitelist containing only permitted database fields. Any un-whitelisted properties are discarded.
  const allowedKeys = [
    'id',
    'name',
    'price',
    'originalPrice',
    'discount',
    'category',
    'image',
    'description',
    'inStock',
    'stockStatus',
    'shopId',
    'shopName',
    'rating',
    'isBestSeller',
    'status',
    'deleted',
    'unit'
  ];

  const sanitized: any = {};

  for (const key of allowedKeys) {
    if (rawProduct[key] !== undefined && rawProduct[key] !== null) {
      const val = rawProduct[key];

      // Safe Type-Casting & Anti-Injection Sanitization
      if (key === 'id' || key === 'name' || key === 'category' || key === 'image' || key === 'description' || key === 'stockStatus' || key === 'shopId' || key === 'shopName' || key === 'status' || key === 'unit') {
        sanitized[key] = String(val).trim();
      } else if (key === 'price' || key === 'originalPrice' || key === 'discount' || key === 'rating') {
        const numVal = Number(val);
        sanitized[key] = isNaN(numVal) ? 0 : numVal;
      } else if (key === 'inStock' || key === 'isBestSeller' || key === 'deleted') {
        sanitized[key] = Boolean(val);
      }
    }
  }

  return sanitized;
}

/**
 * Phase 4: Schema Sanitization & Anti-Injection Layer (Pure Data Enforcement)
 * Validates and whitelists incoming updateData payloads for shops to block extra keys or malicious injections.
 */
export function sanitizeShopUpdatePayload(rawUpdate: any): any {
  if (!rawUpdate || typeof rawUpdate !== 'object') {
    return {};
  }

  const allowedKeys = [
    'id',
    'name',
    'type',
    'category',
    'defaultCategory',
    'address',
    'ownerPhone',
    'ownerName',
    'isOpen',
    'status',
    'imageUrl',
    'image',
    'rating',
    'ratingCount',
    'lat',
    'lng',
    'pinned',
    'joinedAt',
    'description',
    'minTime',
    'maxTime',
    'distance',
    'promo'
  ];

  const sanitized: any = {};

  for (const key of allowedKeys) {
    if (rawUpdate[key] !== undefined && rawUpdate[key] !== null) {
      const val = rawUpdate[key];

      if (key === 'id' || key === 'name' || key === 'type' || key === 'category' || key === 'defaultCategory' || key === 'address' || key === 'ownerPhone' || key === 'ownerName' || key === 'status' || key === 'imageUrl' || key === 'image' || key === 'rating' || key === 'joinedAt' || key === 'description' || key === 'distance' || key === 'promo') {
        sanitized[key] = String(val).trim();
      } else if (key === 'ratingCount' || key === 'lat' || key === 'lng' || key === 'minTime' || key === 'maxTime') {
        const numVal = Number(val);
        sanitized[key] = isNaN(numVal) ? 0 : numVal;
      } else if (key === 'isOpen' || key === 'pinned') {
        sanitized[key] = val === true || val === 'true' || val === 1 || val === '1';
      }
    }
  }

  return sanitized;
}
