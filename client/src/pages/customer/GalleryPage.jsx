import { useEffect, useState } from 'react';
import { ArrowLeft, Camera, ImagePlus, Loader2, Send, Star, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

const emptyForm = { customerName: '', review: '', rating: 5 };

function Stars({ rating, interactive = false, onChange }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type={interactive ? 'button' : undefined}
          onClick={interactive ? () => onChange(value) : undefined}
          className={interactive ? 'rounded-md p-0.5 transition hover:scale-110' : 'p-0.5'}
          aria-label={interactive ? `${value} star${value === 1 ? '' : 's'}` : undefined}
        >
          <Star size={interactive ? 22 : 14} fill={value <= rating ? 'currentColor' : 'none'} className={value <= rating ? 'text-brew-500' : 'text-espresso-200'} />
        </button>
      ))}
    </div>
  );
}

export default function GalleryPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadGallery = async () => {
    try {
      const { data } = await api.get('/gallery');
      setItems(data.items || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load gallery');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, []);

  const choosePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please choose a JPG, PNG, or WEBP photo.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be 5MB or smaller.');
      return;
    }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!photo) {
      toast.error('Please add a photo from your visit.');
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('customerName', form.customerName.trim());
      body.append('review', form.review.trim());
      body.append('rating', String(form.rating));
      body.append('image', photo);
      const { data } = await api.post('/gallery', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setItems((current) => [data.item, ...current]);
      setForm(emptyForm);
      setPhoto(null);
      setPreview('');
      toast.success('Your Brewhaus moment is now in the gallery.');
    } catch (error) {
      toast.error(error.message || 'Unable to publish your review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-espresso-900">
      <header className="border-b border-foam bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link to="/menu" className="inline-flex items-center gap-2 text-sm font-semibold text-espresso-700 transition hover:text-espresso-950">
            <ArrowLeft size={16} /> Back to menu
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium text-espresso-600 sm:gap-5">
            <Link to="/about" className="hover:text-espresso-950">About</Link>
            <Link to="/offers" className="hover:text-espresso-950">Offers</Link>
            <Link to="/contact" className="hover:text-espresso-950">Contact</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="grid items-end gap-8 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brew-600">Brewhaus community</p>
            <h1 className="mt-3 max-w-2xl font-display text-5xl font-bold leading-[0.98] text-espresso-950 sm:text-6xl">Good coffee looks better together.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-espresso-600">See the cups, plates, and little moments our guests have shared. Add yours to the wall.</p>
          </div>
          <div className="rounded-[2rem] bg-espresso-950 p-6 text-cream shadow-xl shadow-espresso-950/10 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brew-500 text-white"><Camera size={21} /></div>
              <div>
                <div className="font-display text-xl font-bold">Your table, your story</div>
                <div className="mt-1 text-sm text-cream/65">Share a photo and tell us how it felt.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full flex min-h-56 items-center justify-center text-espresso-500"><Loader2 size={28} className="animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="col-span-full rounded-[2rem] border border-dashed border-espresso-200 bg-white/60 px-6 py-16 text-center">
              <ImagePlus className="mx-auto text-brew-500" size={30} />
              <h2 className="mt-4 font-display text-2xl font-bold">Be the first on the wall</h2>
              <p className="mt-2 text-sm text-espresso-500">Share your Brewhaus moment below.</p>
            </div>
          ) : items.map((item) => (
            <article key={item._id} className="group overflow-hidden rounded-[1.7rem] border border-foam bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="aspect-[4/3] overflow-hidden bg-espresso-100">
                <img src={item.imageUrl} alt={`Brewhaus moment shared by ${item.customerName}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <Stars rating={item.rating} />
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-espresso-400">{item.customerName}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-espresso-700">“{item.review}”</p>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-14 grid gap-8 rounded-[2rem] border border-foam bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[0.85fr_1.15fr] lg:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brew-600">Leave a little love</p>
            <h2 className="mt-3 font-display text-4xl font-bold text-espresso-950">Add your moment</h2>
            <p className="mt-4 text-sm leading-7 text-espresso-600">Tell the next guest what you ordered, who you came with, or what made you stay a little longer.</p>
          </div>

          <form onSubmit={submitReview} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-espresso-800">Your name<input required minLength={2} maxLength={60} value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} className="input-field mt-2" placeholder="Aarav" /></label>
              <div><div className="text-sm font-semibold text-espresso-800">Your rating</div><div className="mt-3"><Stars rating={form.rating} interactive onChange={(rating) => setForm({ ...form, rating })} /></div></div>
            </div>
            <label className="block text-sm font-semibold text-espresso-800">Your review<textarea required minLength={8} maxLength={500} value={form.review} onChange={(event) => setForm({ ...form, review: event.target.value })} className="input-field mt-2 min-h-28 resize-y" placeholder="The iced latte and the sunny corner table were perfect..." /></label>

            <div>
              <div className="text-sm font-semibold text-espresso-800">Your photo</div>
              {preview ? (
                <div className="relative mt-2 overflow-hidden rounded-2xl border border-foam bg-cream">
                  <img src={preview} alt="Selected preview" className="h-48 w-full object-cover" />
                  <button type="button" onClick={() => { setPhoto(null); setPreview(''); }} className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-espresso-950/80 text-white" aria-label="Remove selected photo"><X size={16} /></button>
                </div>
              ) : (
                <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-espresso-200 bg-cream px-4 py-8 text-center transition hover:border-brew-400 hover:bg-brew-50">
                  <ImagePlus className="text-brew-600" size={25} />
                  <span className="mt-2 text-sm font-semibold text-espresso-700">Choose a café photo</span>
                  <span className="mt-1 text-xs text-espresso-500">JPG, PNG, or WEBP up to 5MB</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="sr-only" />
                </label>
              )}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto">{submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{submitting ? 'Publishing...' : 'Publish review'}</button>
          </form>
        </section>
      </main>
    </div>
  );
}
