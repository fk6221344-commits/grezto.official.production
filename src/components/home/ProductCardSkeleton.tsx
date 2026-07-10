import React from 'react';

export const ProductCardSkeleton = () => (
  <div className="bg-white rounded-[1.25rem] p-1 pb-2 flex flex-col justify-between border border-gray-100 shadow-sm animate-pulse select-none">
    {/* Image Skeleton */}
    <div className="aspect-[5/4] rounded-[1rem] bg-gray-100 mb-2 w-full" />
    
    {/* Content Area */}
    <div className="px-1 flex-1 flex flex-col justify-between">
      <div>
        {/* Title Lines */}
        <div className="h-3 bg-gray-100 rounded-md w-11/12 mb-1.5" />
        <div className="h-3 bg-gray-100 rounded-md w-2/3 mb-2" />
        {/* Unit Line */}
        <div className="h-2 bg-gray-50 rounded-md w-1/2 mb-3" />
      </div>
      
      {/* Price & Add Button Row */}
      <div className="flex items-center justify-between mt-1 px-1">
        <div className="h-4 bg-gray-100 rounded-md w-1/4" />
        <div className="h-7 bg-gray-100 rounded-xl w-14" />
      </div>
    </div>
  </div>
);

export default ProductCardSkeleton;
