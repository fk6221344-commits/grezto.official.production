export const getRiderPayout = (deliveryCharge: number): number => {
  if (deliveryCharge === 19) return 16;
  if (deliveryCharge === 25) return 19;
  if (deliveryCharge === 28) return 20;
  
  // Fallbacks if not exactly matching the standard tiers
  if (deliveryCharge >= 28) return 20;
  if (deliveryCharge >= 25) return 19;
  if (deliveryCharge >= 19) return 16;
  
  // Base default
  return 20;
};
