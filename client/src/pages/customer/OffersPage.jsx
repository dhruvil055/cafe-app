import { Link } from 'react-router-dom';

const offers = [
  {
    title: 'Early Bird Coffee',
    detail: 'Get 15% off on select coffees before 10:30 AM.',
    badge: 'Morning Deal',
  },
  {
    title: 'Brunch Combo',
    detail: 'Enjoy a sandwich, coffee, and dessert combo at a special price.',
    badge: 'Popular',
  },
  {
    title: 'Student Special',
    detail: 'Any signature coffee with a 10% discount for students with valid ID.',
    badge: 'Campus',
  },
];

export default function OffersPage() {
  return (
    <div className="min-h-screen bg-cream text-espresso-900">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/menu" className="btn-secondary text-sm py-2 px-4">Back to Menu</Link>
          <Link to="/about" className="text-sm font-medium text-espresso-700 hover:text-espresso-900">About us</Link>
        </div>

        <div className="rounded-[2rem] border border-foam bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-brew-500">Today’s offers</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-espresso-900">Good deals, brewed daily.</h1>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {offers.map(offer => (
              <div key={offer.title} className="rounded-3xl border border-foam bg-cream p-5">
                <span className="inline-block rounded-full bg-brew-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-brew-600">
                  {offer.badge}
                </span>
                <h2 className="mt-4 font-display text-2xl font-bold text-espresso-900">{offer.title}</h2>
                <p className="mt-3 text-sm leading-6 text-espresso-600">{offer.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
