import React, { useState } from 'react';
import { BSD_LOGO_DATA_URL } from '../assets/logo';

interface BsdLogoProps {
  className?: string;
  height?: number;
}

export const BsdLogo: React.FC<BsdLogoProps> = ({ className = 'h-9 w-auto', height = 36 }) => {
  const [imgSrc, setImgSrc] = useState<string>('/bsd-white.png');

  return (
    <img
      src={imgSrc}
      alt="BSD Business System Development"
      className={className}
      style={{ height: `${height}px`, width: 'auto', objectFit: 'contain' }}
      loading="eager"
      onError={() => {
        if (imgSrc !== BSD_LOGO_DATA_URL) {
          setImgSrc(BSD_LOGO_DATA_URL);
        }
      }}
    />
  );
};
