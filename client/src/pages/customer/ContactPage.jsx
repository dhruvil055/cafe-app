import { Link } from 'react-router-dom';

const contacts = [
  { label: 'Phone', value: '+91 98765 43210' },
  { label: 'Email', value: 'hello@brewhauscafe.in' },
  { label: 'Address', value: '12 Market Lane, Pune, India' },
  { label: 'Hours', value: 'Mon-Sun • 8:00 AM - 11:00 PM' },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-cream text-espresso-900">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/menu" className="btn-secondary text-sm py-2 px-4">Back to Menu</Link>
          <Link to="/offers" className="text-sm font-medium text-espresso-700 hover:text-espresso-900">Offers</Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-foam bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brew-500">Get in touch</p>
            <h1 className="mt-3 font-display text-4xl font-bold text-espresso-900">We’d love to hear from you.</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-espresso-600">
              Whether you’re planning a casual meetup, asking about catering, or just want to say hello,
              our team is ready to help.
            </p>

            <div className="mt-8 space-y-4">
              {contacts.map(item => (
                <div key={item.label} className="rounded-2xl border border-foam bg-cream p-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-espresso-500">{item.label}</div>
                  <div className="mt-2 text-base font-medium text-espresso-900">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-foam bg-espresso-950 p-6 text-cream shadow-sm sm:p-8">
            <h2 className="font-display text-3xl font-bold">Visit Brewhaus</h2>
            <p className="mt-3 text-sm leading-7 text-cream/80">
              Come by for handcrafted coffee, comforting bites, and a relaxed atmosphere built for long conversations.
            </p>
            <div className="mt-6 rounded-3xl bg-white/5 p-5 text-sm leading-7 text-cream/80">
              <div>12 Market Lane</div>
              <div>Near Camp, Pune</div>
              <div>India</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
