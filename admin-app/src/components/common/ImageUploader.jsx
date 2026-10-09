import { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, X, Link as LinkIcon, Check } from 'lucide-react';
import ImageWithFallback from './ImageWithFallback';

export default function ImageUploader({
  value,
  onChange,
  label = 'Product Image',
  fallbackText = 'Item',
  aspectRatio = 'square', // 'square' | 'video' | 'banner'
}) {
  const [tab, setTab] = useState('upload'); // 'upload' | 'url'
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds 2MB limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        onChange(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const applyUrl = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-stone-700">
        {label}
      </label>

      {value ? (
        <div className="relative group overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 w-full max-w-xs aspect-square flex items-center justify-center">
          <ImageWithFallback
            src={value}
            alt="Preview"
            fallbackText={fallbackText}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded-xl bg-white/90 p-2 text-red-600 hover:bg-white shadow-md transition"
              title="Remove image"
            >
              <X size={16} />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl bg-white/90 p-2 text-stone-800 hover:bg-white shadow-md transition text-xs font-semibold"
              title="Change image"
            >
              Replace
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex gap-1.5 border-b border-stone-200 pb-1.5">
            <button
              type="button"
              onClick={() => setTab('upload')}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition ${
                tab === 'upload' ? 'bg-stone-200 text-stone-900' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Upload file
            </button>
            <button
              type="button"
              onClick={() => setTab('url')}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition ${
                tab === 'url' ? 'bg-stone-200 text-stone-900' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Paste Web URL
            </button>
          </div>

          {tab === 'upload' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/60 p-6 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/20 transition group"
            >
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <UploadCloud size={20} />
              </div>
              <p className="text-xs font-semibold text-stone-800">
                Click to browse or drop an image
              </p>
              <p className="mt-0.5 text-[11px] text-stone-400">
                PNG, JPG, WebP up to 2MB
              </p>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={applyUrl}
                disabled={!urlInput.trim()}
                className="btn-primary rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check size={14} /> Add
              </button>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
