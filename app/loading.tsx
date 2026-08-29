export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8" aria-busy="true" aria-label="页面加载中">
      <div className="h-8 w-56 rounded-md animate-pulse bg-muted/15" />
      <div className="mt-3 h-4 w-80 rounded-md animate-pulse bg-muted/10" />
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 h-72 rounded-lg animate-pulse bg-muted/10" />
        <div className="h-72 rounded-lg animate-pulse bg-muted/10" />
      </div>
    </div>
  );
}
