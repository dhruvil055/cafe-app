import { Link } from 'react-router-dom';

const highlights = [
  { title: 'Slow coffee', text: 'Single-origin brews and handcrafted espresso bars prepared with patience and precision.' },
  { title: 'Comfort-first dining', text: 'Warm interiors, easy seating, and food made for casual evenings and weekend catch-ups.' },
  { title: 'Community vibe', text: 'A welcoming café experience for students, families, professionals, and friends.' },
];

const values = [
  'Fresh ingredients sourced with care',
  'Thoughtful service with a personal touch',
  'A calm, modern café experience every day',
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-cream text-espresso-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/menu" className="btn-secondary text-sm py-2 px-4">Back to Menu</Link>
          <div className="flex items-center gap-2 text-sm text-espresso-600">
            <Link to="/offers" className="hover:text-espresso-900">Offers</Link>
            <span>•</span>
            <Link to="/contact" className="hover:text-espresso-900">Contact</Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-foam bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="bg-espresso-950 p-8 text-cream sm:p-10">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-brew-300">Our story</p>
              <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">Brewhaus, made for slow moments.</h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-cream/80 sm:text-base">
                Founded for people who love great coffee, good conversation, and a space that feels like home,
                Brewhaus blends café culture with warm hospitality and elevated comfort food.
              </p>
            </div>

            <div className="bg-gradient-to-br from-brew-100 to-cream p-8 sm:p-10">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'Since', value: '2022' },
                  { label: 'Guests', value: '10k+' },
                  { label: 'Signature', value: '30+' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-2xl border border-foam bg-white/80 p-4 shadow-sm">
                    <div className="font-display text-3xl font-bold text-espresso-900">{stat.value}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.15em] text-espresso-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          {highlights.map(item => (
            <div key={item.title} className="rounded-3xl border border-foam bg-white p-6 shadow-sm">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brew-100 text-lg text-brew-600">☕</div>
              <h2 className="font-display text-2xl font-bold text-espresso-900">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-espresso-600">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-[2rem] border border-foam bg-white p-6 sm:p-8">
          <h2 className="font-display text-3xl font-bold text-espresso-900">What makes us different</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {values.map(value => (
              <div key={value} className="rounded-2xl bg-cream p-4 text-sm font-medium text-espresso-700">
                {value}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
