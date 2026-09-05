import { useRef } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Coffee, HeartHandshake, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const highlights = [
  { icon: Coffee, title: 'Slow coffee', text: 'Single-origin brews and handcrafted espresso bars prepared with patience and precision.' },
  { icon: Sparkles, title: 'Comfort-first dining', text: 'Warm interiors, easy seating, and food made for casual evenings and weekend catch-ups.' },
  { icon: HeartHandshake, title: 'Community vibe', text: 'A welcoming café experience for students, families, professionals, and friends.' },
];

const values = [
  'Fresh ingredients sourced with care',
  'Thoughtful service with a personal touch',
  'A calm, modern café experience every day',
];

const reveal = {
  initial: { opacity: 0, y: 24, filter: 'blur(8px)' },
  whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
  viewport: { once: true, amount: 0.22 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
};

function SectionEyebrow({ children, light = false }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${light ? 'text-brew-200' : 'text-brew-700'}`}>{children}</p>;
}

export default function AboutPage() {
  const storyRef = useRef(null);

  const scrollToStory = () => storyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const setDepthPosition = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5).toFixed(2);
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5).toFixed(2);
    event.currentTarget.style.setProperty('--about-x', x);
    event.currentTarget.style.setProperty('--about-y', y);
  };

  return (
    <main className="about-page min-h-screen overflow-hidden bg-cream text-espresso-900">
      <section className="about-hero relative isolate min-h-[720px] overflow-hidden bg-espresso-950 text-cream sm:min-h-[760px]">
        <img src="/images/about/brewhaus-cinematic-hero.png" alt="Barista preparing a coffee at Brewhaus" className="absolute inset-0 z-0 h-full w-full object-cover" />
        <video className="absolute inset-0 z-0 h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster="/images/about/brewhaus-cinematic-hero.png" onError={(event) => { event.currentTarget.style.display = 'none'; }} aria-hidden="true">
          <source src="/BrewHaus.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 z-10 bg-[linear-gradient(90deg,rgba(13,8,4,0.94)_0%,rgba(13,8,4,0.74)_45%,rgba(13,8,4,0.22)_100%)]" />
        <div className="absolute inset-0 z-10 bg-[linear-gradient(0deg,rgba(13,8,4,0.82)_0%,transparent_44%)]" />

        <nav className="absolute inset-x-0 top-0 z-30 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8" aria-label="About page navigation">
          <Link to="/menu" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-2 text-xs font-medium text-cream backdrop-blur-md transition hover:bg-white/10 sm:px-4 sm:text-sm">
            <ArrowLeft size={15} /> <span>Back to Menu</span>
          </Link>
          <div className="hidden items-center gap-4 text-xs font-medium text-cream/85 sm:flex sm:gap-6 sm:text-sm">
            <Link to="/offers" className="transition hover:text-brew-200">Offers</Link>
            <Link to="/contact" className="transition hover:text-brew-200">Contact</Link>
          </div>
        </nav>

        <div className="relative z-20 mx-auto flex min-h-[720px] max-w-7xl items-center px-4 pb-20 pt-28 sm:min-h-[760px] sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }} className="w-full min-w-0 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-brew-200">Fine Coffee & Dining</p>
            <p className="mt-6 font-display text-4xl font-bold tracking-[0.16em] text-cream sm:text-5xl">BREWHAUS</p>
            <h1 className="mt-5 max-w-[20rem] font-display text-5xl font-semibold leading-[0.93] text-cream sm:max-w-xl sm:text-7xl lg:text-[5.5rem]">Brewhaus, made for slow moments.</h1>
            <p className="mt-7 max-w-[21rem] text-base leading-7 text-cream/80 sm:max-w-lg sm:text-lg">
              Founded for people who love great coffee, good conversation, and a space that feels like home, Brewhaus blends café culture with warm hospitality and elevated comfort food.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button type="button" onClick={scrollToStory} className="inline-flex items-center gap-2 rounded-full bg-cream px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-espresso-900 transition hover:bg-brew-100 sm:px-6">
                Discover our story <ArrowDown size={15} />
              </button>
              <span className="hidden text-xs font-medium uppercase tracking-[0.2em] text-cream/55 sm:inline">A place to pause</span>
            </div>
          </motion.div>
        </div>

        <div className="about-hero-cup pointer-events-none absolute bottom-0 right-8 z-20 hidden w-64 md:block lg:right-[8%] lg:w-72" aria-hidden="true">
          <div className="rounded-t-[9rem] border border-white/25 bg-cream/10 p-2 shadow-[0_30px_55px_rgba(0,0,0,0.3)] backdrop-blur-sm">
            <img src="/images/about/brewhaus-story-cup.png" alt="" className="h-[22rem] w-full rounded-t-[8.3rem] object-cover object-bottom" />
          </div>
          <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/70">Slowly made</p>
        </div>
      </section>

      <section ref={storyRef} className="scroll-mt-6 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          <motion.div {...reveal}>
            <SectionEyebrow>Our story</SectionEyebrow>
            <h2 className="mt-5 max-w-xl font-display text-5xl font-semibold leading-[0.98] text-espresso-950 sm:text-6xl">A little more time for what matters.</h2>
            <p className="mt-7 max-w-lg text-base leading-8 text-espresso-600">
              Brewhaus is made for the unhurried parts of the day: a thoughtful cup, an easy meal, and conversations that need a little more room.
            </p>
            <blockquote className="mt-9 border-l-2 border-brew-500 pl-5 font-display text-3xl leading-tight text-espresso-800 sm:text-4xl">“Brewhaus, made for slow moments.”</blockquote>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-3 border-t border-espresso-200 pt-6">
              {[['Since', '2022'], ['Guests', '10k+'], ['Signature', '30+']].map(([label, value]) => <div key={label}><dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-espresso-500">{label}</dt><dd className="mt-1 font-display text-2xl font-semibold text-espresso-900">{value}</dd></div>)}
            </dl>
          </motion.div>

          <motion.div {...reveal} onMouseMove={setDepthPosition} onMouseLeave={(event) => { event.currentTarget.style.setProperty('--about-x', 0); event.currentTarget.style.setProperty('--about-y', 0); }} className="about-depth relative mx-auto w-full max-w-xl pb-8 pr-4 sm:pr-10">
            <div className="absolute inset-x-10 bottom-0 top-12 rounded-[2.5rem] bg-brew-100" />
            <div className="about-depth-layer relative overflow-hidden rounded-[2.2rem] bg-espresso-900 shadow-[0_28px_70px_rgba(26,15,8,0.22)]">
              <img src="/images/about/brewhaus-story-cup.png" alt="Freshly brewed coffee at Brewhaus" className="h-[34rem] w-full object-cover sm:h-[42rem]" loading="lazy" />
            </div>
            <div className="about-depth-layer absolute -bottom-1 -left-1 rounded-2xl border border-white/60 bg-cream/90 px-5 py-4 shadow-lg backdrop-blur-sm sm:left-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brew-700">Made to linger</p>
              <p className="mt-1 text-sm text-espresso-700">Coffee, food, and good company.</p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-espresso-100 bg-[#f0e7dc] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div {...reveal} className="max-w-2xl">
            <SectionEyebrow>Crafted with care</SectionEyebrow>
            <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.98] text-espresso-950 sm:text-6xl">The feeling is in the details.</h2>
          </motion.div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {highlights.map(({ icon: Icon, title, text }, index) => (
              <motion.article key={title} {...reveal} transition={{ ...reveal.transition, delay: index * 0.08 }} className="group rounded-[1.75rem] border border-white/80 bg-white/70 p-7 shadow-[0_12px_30px_rgba(58,39,23,0.07)] backdrop-blur-sm transition duration-500 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_rgba(58,39,23,0.13)]">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brew-100 text-brew-700"><Icon size={19} /></span>
                <h3 className="mt-8 font-display text-3xl font-semibold text-espresso-900">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-espresso-600">{text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-espresso-950 px-4 py-24 text-cream sm:px-6 lg:px-8">
        <img src="/images/about/brewhaus-cinematic-hero.png" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-45" loading="lazy" />
        <video className="absolute inset-0 -z-10 h-full w-full object-cover opacity-65 mix-blend-luminosity" autoPlay muted loop playsInline preload="none" poster="/images/about/brewhaus-cinematic-hero.png" onError={(event) => { event.currentTarget.style.display = 'none'; }} aria-hidden="true">
          <source src="/BrewHaus.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 -z-10 bg-espresso-950/55" />
        <motion.div {...reveal} className="mx-auto max-w-3xl text-center">
          <SectionEyebrow light>Brewhaus experience</SectionEyebrow>
          <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.98] text-cream sm:text-7xl">The ritual, from the first pour.</h2>
          <p className="mx-auto mt-7 max-w-xl text-base leading-8 text-cream/80">A warm table, a carefully made cup, and time that feels well spent.</p>
        </motion.div>
      </section>

      <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20">
          <motion.div {...reveal} onMouseMove={setDepthPosition} onMouseLeave={(event) => { event.currentTarget.style.setProperty('--about-x', 0); event.currentTarget.style.setProperty('--about-y', 0); }} className="about-depth relative order-2 lg:order-1">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-espresso-100" />
            <div className="about-depth-layer relative overflow-hidden rounded-[2rem] shadow-[0_24px_60px_rgba(26,15,8,0.16)]">
              <img src="/images/about/brewhaus-cinematic-hero.png" alt="Coffee being prepared at the Brewhaus counter" className="h-[25rem] w-full object-cover sm:h-[34rem]" loading="lazy" />
            </div>
          </motion.div>
          <motion.div {...reveal} className="order-1 lg:order-2">
            <SectionEyebrow>What makes us different</SectionEyebrow>
            <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.98] text-espresso-950 sm:text-6xl">Coffee, prepared with patience.</h2>
            <div className="mt-8 space-y-3">
              {values.map((value, index) => <div key={value} className="flex items-center gap-4 rounded-2xl border border-espresso-100 bg-white px-5 py-4 shadow-sm"><span className="font-display text-2xl text-brew-600">0{index + 1}</span><p className="text-sm font-medium text-espresso-700">{value}</p></div>)}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-espresso-950 px-4 py-24 text-center text-cream sm:px-6 sm:py-32 lg:px-8">
        <img src="/images/about/brewhaus-story-cup.png" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-40" loading="lazy" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(154,96,49,0.42),rgba(13,8,4,0.95)_70%)]" />
        <motion.div {...reveal} className="mx-auto max-w-3xl">
          <SectionEyebrow light>Fine Coffee & Dining</SectionEyebrow>
          <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.96] text-cream sm:text-7xl">Come experience Brewhaus.</h2>
          <p className="mx-auto mt-7 max-w-xl text-base leading-8 text-cream/75">A calm, modern café experience made for every kind of gathering.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/menu" className="inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-espresso-900 transition hover:bg-brew-100">View menu <ArrowRight size={15} /></Link>
            <Link to="/contact" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-cream backdrop-blur-sm transition hover:bg-white/10">Visit Brewhaus <ArrowRight size={15} /></Link>
          </div>
        </motion.div>
      </section>

      <footer className="bg-[#0a0603] px-4 py-10 text-cream/65 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
          <div><p className="font-display text-2xl font-semibold tracking-[0.12em] text-cream">BREWHAUS</p><p className="mt-2 text-xs uppercase tracking-[0.2em] text-brew-300">Fine Coffee & Dining</p></div>
          <div className="flex justify-center gap-5 text-sm sm:justify-end"><Link to="/menu" className="transition hover:text-cream">Menu</Link><Link to="/offers" className="transition hover:text-cream">Offers</Link><Link to="/contact" className="transition hover:text-cream">Contact</Link></div>
        </div>
      </footer>
    </main>
  );
}
