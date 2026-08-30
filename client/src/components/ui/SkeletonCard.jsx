export default function SkeletonCard() {
  return (
    <div className="card overflow-hidden">
      <div className="aspect-square skeleton" />
      <div className="p-2.5 space-y-2">
        <div className="h-3.5 skeleton rounded-lg w-3/4" />
        <div className="h-2.5 skeleton rounded-lg w-1/2" />
        <div className="flex items-center justify-between mt-2">
          <div className="h-3.5 skeleton rounded-lg w-10" />
          <div className="w-7 h-7 skeleton rounded-full" />
        </div>
      </div>
    </div>
  );
}
