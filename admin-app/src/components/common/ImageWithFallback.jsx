import { useState } from 'react';
import { Utensils, Image as ImageIcon } from 'lucide-react';

export default function ImageWithFallback({
  src,
  alt = '',
  className = '',
  fallbackIcon = Utensils,
  fallbackText = '',
}) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const Icon = fallbackIcon;

  if (!src || error) {
    return (
      <div className={`flex items-center justify-center bg-stone-100 text-stone-400 select-none ${className}`}>
        {fallbackText ? (
          <span className="font-bold text-sm text-stone-500 uppercase">{fallbackText.slice(0, 2)}</span>
        ) : (
          <Icon size={24} className="text-stone-300" />
        )}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-stone-100 ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-stone-200" />
      )}
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}
