import React from 'react';
import SlidingBanner from './SlidingBanner';

interface HomeBannersProps {
  onPromoClick?: (query: string) => void;
}

export default function HomeBanners({ onPromoClick }: HomeBannersProps) {
  return (
    <div className="space-y-4">
      {/* 🎬 Sliding visual banner */}
      <SlidingBanner />
    </div>
  );
}
