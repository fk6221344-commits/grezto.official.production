/**
 * Utility to group multi-vendor sister orders (e.g., c_132_0, c_132_1) 
 * into a single unified order representation for the Rider console.
 */
export const groupMultiVendorOrders = (rawOrders: any[]) => {
  if (!rawOrders || rawOrders.length === 0) return [];

  const groups: { [key: string]: any[] } = {};
  
  for (const order of rawOrders) {
    const id = order.id || '';
    const lastUnderscoreIndex = id.lastIndexOf('_');
    const basePrefix = lastUnderscoreIndex !== -1 ? id.substring(0, lastUnderscoreIndex) : null;
    
    if (basePrefix && basePrefix.startsWith('c_')) {
      if (!groups[basePrefix]) {
        groups[basePrefix] = [];
      }
      groups[basePrefix].push(order);
    } else {
      // Non-sister order, keep separate
      groups[id] = [order];
    }
  }
  
  return Object.entries(groups).map(([prefix, group]) => {
    if (group.length === 1) {
      return group[0];
    }
    
    // Grouped order
    const primary = group[0];
    
    // Sum total Amount for Cash Collection
    const totalAmount = group.reduce((sum, o) => sum + Number(o.totalAmount || o.amount || 0), 0);
    const deliveryCharge = group.reduce((sum, o) => sum + Number(o.deliveryCharge || 0), 0);
    const finalAmount = group.reduce((sum, o) => sum + Number(o.finalAmount || o.totalAmount || o.amount || 0), 0);
    
    // Combine items
    const items: any[] = [];
    for (const o of group) {
      const orderItems = o.items || o.fullItems || [];
      items.push(...orderItems);
    }
    
    // Create sister IDs list
    const sisterIds = group.map(o => o.id);
    
    // Are all accepted?
    const allAccepted = group.every(o => o.riderAccepted);
    const anyAccepted = group.some(o => o.riderAccepted);
    
    return {
      ...primary,
      id: prefix, // Group ID is the prefix (e.g. c_132)
      originalId: primary.id,
      sisterIds,
      totalAmount,
      deliveryCharge,
      finalAmount,
      items,
      riderAccepted: allAccepted || anyAccepted, // If accepted, treat group as accepted
      isGrouped: true,
      subOrders: group
    };
  }).sort((a, b) => {
    const getTime = (d: any) => d.createdAt ? new Date(d.createdAt).getTime() : 0;
    return getTime(b) - getTime(a);
  });
};
