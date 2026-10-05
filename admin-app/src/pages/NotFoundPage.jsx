import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return <main className="flex min-h-screen flex-col items-center justify-center bg-stone-100 px-5 text-center text-stone-900"><p className="font-mono text-sm font-semibold tracking-[0.2em] text-orange-700">404</p><h1 className="mt-3 font-display text-3xl font-bold">Page not found</h1><p className="mt-2 text-stone-600">This admin page does not exist.</p><Link to="/dashboard" className="btn-primary mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-6">Back to dashboard</Link></main>;
}
