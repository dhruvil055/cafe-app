export default function SkeletonCard() {
  return (
    <div className="card flex flex-col justify-between overflow-hidden bg-white border border-foam">
      {/* Aspect Square Image Shimmer */}
      <div className="relative aspect-square w-full skeleton bg-foam/90 overflow-hidden">
        <div className="absolute top-2.5 left-2.5 w-4 h-4 rounded-[4px] skeleton" />
      </div>

      {/* Info Shimmer */}
      <div className="p-3 sm:p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <div className="h-4 skeleton rounded-md w-3/4" />
          <div className="h-3 skeleton rounded-md w-full opacity-70" />
        </div>

        {/* Price & Button Row */}
        <div className="flex items-center justify-between pt-2 border-t border-foam/70">
          <div className="h-4 skeleton rounded-md w-12" />
          <div className="h-8 w-14 skeleton rounded-xl" />
        </div>
      </div>
    </div>
  );
}
