import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return <main className="flex min-h-[75vh] flex-col items-center justify-center bg-cream px-5 text-center text-espresso-900"><p className="font-mono text-sm font-semibold tracking-[0.2em] text-brew-700">404</p><h1 className="mt-3 font-display text-3xl font-bold">We couldn’t find that page</h1><p className="mt-2 max-w-md text-stone-600">The link may be outdated. Head back to the menu to continue.</p><Link to="/menu" className="btn-primary mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-6">View the menu</Link></main>;
}
