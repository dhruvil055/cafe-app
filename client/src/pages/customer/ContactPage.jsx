import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Coffee,
  Compass,
} from 'lucide-react';
import api from '../../services/api';

const contactDetails = [
  {
    id: 'address',
    label: 'Visit Us',
    value: '12 Market Lane, Near Camp, Pune, India',
    subvalue: 'Ground Floor, Heritage Quarter',
    icon: MapPin,
    action: {
      type: 'link',
      href: 'https://www.google.com/maps/search/?api=1&query=12+Market+Lane+Near+Camp+Pune+India',
      text: 'Get Directions',
      external: true,
    },
  },
  {
    id: 'phone',
    label: 'Call Us',
    value: '+91 98765 43210',
    subvalue: 'Available during café hours',
    icon: Phone,
    action: {
      type: 'tel',
      href: 'tel:+919876543210',
      text: 'Call Now',
    },
  },
  {
    id: 'email',
    label: 'Email Us',
    value: 'hello@brewhauscafe.in',
    subvalue: 'For catering, events & inquiries',
    icon: Mail,
    action: {
      type: 'mailto',
      href: 'mailto:hello@brewhauscafe.in',
      text: 'Send Email',
    },
  },
  {
    id: 'hours',
    label: 'Opening Hours',
    value: 'Mon - Sun: 8:00 AM – 11:00 PM',
    subvalue: 'Kitchen closes at 10:30 PM',
    icon: Clock,
    action: {
      type: 'copy',
      copyText: 'Mon - Sun: 8:00 AM – 11:00 PM',
      text: 'Copy Hours',
    },
  },
];

const reveal = {
  initial: { opacity: 0, y: 24, filter: 'blur(8px)' },
  whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
};

function SectionEyebrow({ children, light = false }) {
  return (
    <p
      className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${
        light ? 'text-brew-200' : 'text-brew-700'
      }`}
    >
      {children}
    </p>
  );
}

export default function ContactPage() {
  const contactSectionRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    subject: '',
    message: '',
    honeypot: '', // anti-spam bot trap
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState('');

  const scrollToContact = () => {
    contactSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCopy = (text, id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const setHeroDepth = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5).toFixed(2);
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5).toFixed(2);
    event.currentTarget.style.setProperty('--contact-x', x);
    event.currentTarget.style.setProperty('--contact-y', y);
  };

  const validateField = (name, value) => {
    let error = '';
    const trimmed = String(value || '').trim();

    if (name === 'name') {
      if (!trimmed) {
        error = 'Please enter your name.';
      } else if (trimmed.length < 2) {
        error = 'Name must be at least 2 characters.';
      } else if (trimmed.length > 80) {
        error = 'Name must be 80 characters or less.';
      }
    }

    if (name === 'contact') {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phonePattern = /^[0-9+()\-\s]{7,20}$/;
      if (!trimmed) {
        error = 'Please enter your email or phone number.';
      } else if (!emailPattern.test(trimmed) && !phonePattern.test(trimmed)) {
        error = 'Please enter a valid email address or phone number.';
      }
    }

    if (name === 'subject') {
      if (trimmed.length > 140) {
        error = 'Subject must be 140 characters or less.';
      }
    }

    if (name === 'message') {
      if (!trimmed) {
        error = 'Please enter your message.';
      } else if (trimmed.length < 8) {
        error = 'Message must be at least 8 characters.';
      } else if (trimmed.length > 2000) {
        error = 'Message must be 2,000 characters or less.';
      }
    }

    return error;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setServerError('');

    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    if (name !== 'honeypot') {
      const error = validateField(name, value);
      if (error) {
        setFormErrors((prev) => ({ ...prev, [name]: error }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    // Spam honeypot test
    if (formData.honeypot) {
      setIsSuccess(true);
      return;
    }

    // Validate all fields
    const errors = {};
    const nameErr = validateField('name', formData.name);
    const contactErr = validateField('contact', formData.contact);
    const subjectErr = validateField('subject', formData.subject);
    const messageErr = validateField('message', formData.message);

    if (nameErr) errors.name = nameErr;
    if (contactErr) errors.contact = contactErr;
    if (subjectErr) errors.subject = subjectErr;
    if (messageErr) errors.message = messageErr;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstKey = Object.keys(errors)[0];
      const element = document.getElementById(`field-${firstKey}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/contact', {
        name: formData.name.trim(),
        contact: formData.contact.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
      });

      setIsSuccess(true);
      toast.success('Your message has been sent to Brewhaus.');
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        'Unable to send your message right now. Please try again shortly.';
      setServerError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setFormData({
      name: '',
      contact: '',
      subject: '',
      message: '',
      honeypot: '',
    });
    setFormErrors({});
    setServerError('');
    setIsSuccess(false);
  };

  return (
    <main className="contact-page min-h-screen overflow-hidden bg-cream text-espresso-900">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION WITH CINEMATIC VIDEO & 3D FLOATING CUP */}
      {/* ========================================================================= */}
      <section
        onMouseMove={setHeroDepth}
        onMouseLeave={(event) => {
          event.currentTarget.style.setProperty('--contact-x', 0);
          event.currentTarget.style.setProperty('--contact-y', 0);
        }}
        className="contact-hero relative isolate min-h-[720px] overflow-hidden bg-espresso-950 text-cream sm:min-h-[780px]"
      >
        {/* Background Video & Fallback Poster */}
        <img
          src="/images/about/brewhaus-cinematic-hero.png"
          alt="Barista preparing handcrafted coffee at Brewhaus"
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
        <video
          className="absolute inset-0 z-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/images/about/brewhaus-cinematic-hero.png"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
          aria-hidden="true"
        >
          <source src="/BrewHaus.mp4" type="video/mp4" />
        </video>

        {/* Ambient Gradient Overlays for Luxury Contrast */}
        <div className="absolute inset-0 z-10 bg-[linear-gradient(90deg,rgba(13,8,4,0.96)_0%,rgba(13,8,4,0.80)_48%,rgba(13,8,4,0.35)_100%)]" />
        <div className="absolute inset-0 z-10 bg-[linear-gradient(0deg,rgba(13,8,4,0.88)_0%,transparent_50%)]" />

        {/* Navigation Bar */}
        <nav
          className="absolute inset-x-0 top-0 z-30 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8"
          aria-label="Contact page navigation"
        >
          <Link
            to="/menu"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3.5 py-2 text-xs font-medium text-cream backdrop-blur-md transition-all duration-300 hover:bg-white/15 active:scale-95 sm:px-4 sm:text-sm"
          >
            <ArrowLeft size={15} /> <span>Back to Menu</span>
          </Link>
          <div className="flex items-center gap-4 text-xs font-medium text-cream/85 sm:gap-6 sm:text-sm">
            <Link to="/about" className="transition hover:text-brew-200">
              About
            </Link>
            <Link to="/offers" className="transition hover:text-brew-200">
              Offers
            </Link>
            <Link to="/gallery" className="transition hover:text-brew-200">
              Gallery
            </Link>
            <Link
              to="/contact"
              className="rounded-full bg-white/10 px-3 py-1 text-brew-200 backdrop-blur-sm"
            >
              Contact
            </Link>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-20 mx-auto flex min-h-[720px] max-w-7xl items-center px-4 pb-20 pt-28 sm:min-h-[780px] sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="w-full min-w-0 max-w-2xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-brew-200">
              Get in touch
            </p>
            <p className="mt-4 font-display text-3xl font-bold tracking-[0.16em] text-cream sm:text-4xl">
              BREWHAUS
            </p>
            <h1 className="mt-4 max-w-xl font-display text-5xl font-semibold leading-[0.94] text-cream sm:text-7xl lg:text-[5.25rem]">
              We’d love to hear from you.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-cream/80 sm:text-lg">
              Whether you’re planning a casual meetup, asking about catering, or just want to say
              hello, our team is ready to welcome and assist you.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={scrollToContact}
                className="inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-espresso-900 shadow-[0_10px_25px_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-brew-100 hover:shadow-[0_14px_30px_rgba(0,0,0,0.4)] active:scale-95"
              >
                Reach out to us <ArrowDown size={15} />
              </button>
              <a
                href="https://www.google.com/maps/search/?api=1&query=12+Market+Lane+Near+Camp+Pune+India"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream backdrop-blur-md transition-all hover:bg-white/20"
              >
                <MapPin size={14} className="text-brew-300" />
                <span>Visit Pune Café</span>
              </a>
            </div>
          </motion.div>
        </div>

        {/* 3D Floating Ceramic Cup with Steam Effect */}
        <div
          className="contact-hero-cup pointer-events-none absolute bottom-6 right-6 z-20 hidden w-64 md:block lg:right-[8%] lg:w-72"
          aria-hidden="true"
        >
          {/* Subtle Ambient Steam Particles */}
          <div className="relative mb-[-12px] flex justify-center gap-3">
            <span className="steam-particle-1 inline-block h-6 w-2 rounded-full bg-cream/35 blur-[2px]" />
            <span className="steam-particle-2 inline-block h-8 w-2.5 rounded-full bg-cream/45 blur-[2.5px]" />
            <span className="steam-particle-3 inline-block h-5 w-2 rounded-full bg-cream/30 blur-[2px]" />
          </div>

          <div className="rounded-t-[9rem] border border-white/25 bg-cream/10 p-2.5 shadow-[0_30px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <img
              src="/images/about/brewhaus-story-cup.png"
              alt="Brewhaus handcrafted coffee cup"
              className="h-[22rem] w-full rounded-t-[8.3rem] object-cover object-bottom"
            />
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-cream/70">
            <Sparkles size={12} className="text-brew-300" />
            <span>Crafted with precision</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. CONTACT INFORMATION EDITORIAL CARDS */}
      {/* ========================================================================= */}
      <section ref={contactSectionRef} className="scroll-mt-8 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Direct channels</SectionEyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1] text-espresso-950 sm:text-5xl lg:text-6xl">
              Every way to connect.
            </h2>
            <p className="mt-5 text-base leading-7 text-espresso-600">
              Have a question about our specialty brews, dietary options, or private table
              reservations? Reach out directly through any of our channels.
            </p>
          </div>

          {/* 3D Depth Elevation Cards */}
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {contactDetails.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.id}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: index * 0.08 }}
                  className="group relative flex flex-col justify-between rounded-[2rem] border border-espresso-100 bg-white p-7 shadow-[0_10px_28px_rgba(58,39,23,0.06)] transition-all duration-400 hover:-translate-y-1.5 hover:border-brew-200 hover:shadow-[0_20px_40px_rgba(58,39,23,0.12)]"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brew-100/80 text-brew-700 transition-colors duration-300 group-hover:bg-brew-500 group-hover:text-white">
                        <Icon size={20} />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-espresso-400">
                        0{index + 1}
                      </span>
                    </div>

                    <h3 className="mt-6 font-display text-2xl font-bold text-espresso-900">
                      {item.label}
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-espresso-800">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-espresso-500">{item.subvalue}</p>
                  </div>

                  <div className="mt-8 border-t border-espresso-100/80 pt-5">
                    {item.action.type === 'copy' ? (
                      <button
                        type="button"
                        onClick={() => handleCopy(item.action.copyText, item.id)}
                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brew-700 transition hover:text-espresso-900"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check size={14} className="text-green-600" />
                            <span className="text-green-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>{item.action.text}</span>
                          </>
                        )}
                      </button>
                    ) : item.action.external ? (
                      <a
                        href={item.action.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brew-700 transition hover:text-espresso-900"
                      >
                        <span>{item.action.text}</span>
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <a
                        href={item.action.href}
                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brew-700 transition hover:text-espresso-900"
                      >
                        <span>{item.action.text}</span>
                        <ArrowRight size={14} />
                      </a>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. CONTACT FORM & EDITORIAL DETAILS */}
      {/* ========================================================================= */}
      <section className="border-t border-espresso-100 bg-[#f7f1e8] px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            {/* Left Context Column */}
            <motion.div {...reveal} className="flex flex-col justify-between">
              <div>
                <SectionEyebrow>Write to Brewhaus</SectionEyebrow>
                <h2 className="mt-4 font-display text-4xl font-semibold leading-[1] text-espresso-950 sm:text-5xl lg:text-6xl">
                  Send us a direct message.
                </h2>
                <p className="mt-6 text-base leading-8 text-espresso-600">
                  Whether you have feedback about your visit, want to partner with us, or are
                  inquiring about catering for special events, we will respond promptly.
                </p>

                <div className="mt-10 space-y-5">
                  <div className="rounded-2xl border border-espresso-200/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3 text-espresso-900">
                      <Clock size={18} className="text-brew-600" />
                      <span className="text-xs font-bold uppercase tracking-[0.16em]">
                        Response Time
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-espresso-600">
                      We usually respond within 24 hours during standard café operating days.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-espresso-200/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3 text-espresso-900">
                      <Coffee size={18} className="text-brew-600" />
                      <span className="text-xs font-bold uppercase tracking-[0.16em]">
                        Large Gatherings & Events
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-espresso-600">
                      Looking to book tables for groups or private celebrations? Mention the date and
                      estimated party size in the subject or message.
                    </p>
                  </div>
                </div>
              </div>

              {/* Direct Quote */}
              <div className="mt-10 border-l-2 border-brew-500 pl-5">
                <p className="font-display text-2xl font-medium italic text-espresso-900">
                  “A thoughtful cup, an easy meal, and conversations that need a little more room.”
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-brew-700">
                  Brewhaus Hospitality
                </p>
              </div>
            </motion.div>

            {/* Right Contact Form / Success Container */}
            <motion.div
              {...reveal}
              className="relative overflow-hidden rounded-[2.5rem] border border-white/90 bg-white p-7 shadow-[0_20px_50px_rgba(58,39,23,0.08)] sm:p-10 lg:p-12"
            >
              <AnimatePresence mode="wait">
                {!isSuccess ? (
                  <motion.form
                    key="contact-form"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.4 }}
                    onSubmit={handleSubmit}
                    noValidate
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="font-display text-3xl font-semibold text-espresso-900">
                        Leave a message
                      </h3>
                      <p className="mt-1 text-xs text-espresso-500">
                        Fields marked with <span className="text-brew-600">*</span> are required.
                      </p>
                    </div>

                    {serverError && (
                      <div
                        role="alert"
                        className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800"
                      >
                        {serverError}
                      </div>
                    )}

                    {/* Anti-spam honeypot (hidden from real users) */}
                    <div className="hidden" aria-hidden="true">
                      <label htmlFor="field-honeypot">Leave blank</label>
                      <input
                        id="field-honeypot"
                        type="text"
                        name="honeypot"
                        tabIndex={-1}
                        autoComplete="off"
                        value={formData.honeypot}
                        onChange={handleInputChange}
                      />
                    </div>

                    {/* Full Name */}
                    <div>
                      <label
                        htmlFor="field-name"
                        className="block text-xs font-bold uppercase tracking-[0.16em] text-espresso-700"
                      >
                        Your Name <span className="text-brew-600">*</span>
                      </label>
                      <div className="mt-2">
                        <input
                          id="field-name"
                          name="name"
                          type="text"
                          required
                          maxLength={80}
                          placeholder="e.g. Dhruvil Sharma"
                          value={formData.name}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                          className={`w-full rounded-2xl border bg-espresso-50/50 px-5 py-3.5 text-sm font-medium text-espresso-900 placeholder:text-espresso-400 focus:bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                            formErrors.name
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                              : 'border-espresso-200/80 focus:border-brew-500 focus:ring-brew-200/60'
                          }`}
                        />
                      </div>
                      {formErrors.name && (
                        <p className="mt-1.5 text-xs font-medium text-red-600">{formErrors.name}</p>
                      )}
                    </div>

                    {/* Email or Phone */}
                    <div>
                      <label
                        htmlFor="field-contact"
                        className="block text-xs font-bold uppercase tracking-[0.16em] text-espresso-700"
                      >
                        Email or Phone Number <span className="text-brew-600">*</span>
                      </label>
                      <div className="mt-2">
                        <input
                          id="field-contact"
                          name="contact"
                          type="text"
                          required
                          maxLength={160}
                          placeholder="e.g. name@example.com or +91 98765 43210"
                          value={formData.contact}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                          className={`w-full rounded-2xl border bg-espresso-50/50 px-5 py-3.5 text-sm font-medium text-espresso-900 placeholder:text-espresso-400 focus:bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                            formErrors.contact
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                              : 'border-espresso-200/80 focus:border-brew-500 focus:ring-brew-200/60'
                          }`}
                        />
                      </div>
                      {formErrors.contact && (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {formErrors.contact}
                        </p>
                      )}
                    </div>

                    {/* Subject */}
                    <div>
                      <label
                        htmlFor="field-subject"
                        className="block text-xs font-bold uppercase tracking-[0.16em] text-espresso-700"
                      >
                        Subject <span className="text-xs font-normal text-espresso-400">(Optional)</span>
                      </label>
                      <div className="mt-2">
                        <input
                          id="field-subject"
                          name="subject"
                          type="text"
                          maxLength={140}
                          placeholder="e.g. Table reservation / Coffee inquiry"
                          value={formData.subject}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                          className={`w-full rounded-2xl border bg-espresso-50/50 px-5 py-3.5 text-sm font-medium text-espresso-900 placeholder:text-espresso-400 focus:bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                            formErrors.subject
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                              : 'border-espresso-200/80 focus:border-brew-500 focus:ring-brew-200/60'
                          }`}
                        />
                      </div>
                      {formErrors.subject && (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {formErrors.subject}
                        </p>
                      )}
                    </div>

                    {/* Message */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="field-message"
                          className="block text-xs font-bold uppercase tracking-[0.16em] text-espresso-700"
                        >
                          Message <span className="text-brew-600">*</span>
                        </label>
                        <span className="text-[11px] text-espresso-400">
                          {formData.message.length} / 2000
                        </span>
                      </div>
                      <div className="mt-2">
                        <textarea
                          id="field-message"
                          name="message"
                          required
                          rows={4}
                          maxLength={2000}
                          placeholder="Tell us what's on your mind..."
                          value={formData.message}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                          className={`w-full resize-y rounded-2xl border bg-espresso-50/50 px-5 py-3.5 text-sm font-medium text-espresso-900 placeholder:text-espresso-400 focus:bg-white focus:outline-none focus:ring-2 transition-all duration-200 ${
                            formErrors.message
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                              : 'border-espresso-200/80 focus:border-brew-500 focus:ring-brew-200/60'
                          }`}
                        />
                      </div>
                      {formErrors.message && (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {formErrors.message}
                        </p>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-espresso-900 py-4 text-xs font-bold uppercase tracking-[0.2em] text-cream shadow-md transition-all duration-300 hover:bg-espresso-800 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-cream border-t-transparent" />
                          <span>Sending message...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Message</span>
                          <Send size={15} />
                        </>
                      )}
                    </button>
                  </motion.form>
                ) : (
                  <motion.div
                    key="success-confirmation"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col items-center py-8 text-center sm:py-12"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brew-100 text-brew-700 shadow-inner">
                      <CheckCircle2 size={44} className="stroke-[1.6]" />
                    </div>

                    <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-brew-700">
                      Message Sent
                    </p>
                    <h3 className="mt-2 font-display text-4xl font-semibold text-espresso-950">
                      Thank you for contacting Brewhaus.
                    </h3>
                    <p className="mt-4 max-w-md text-sm leading-relaxed text-espresso-600">
                      We have received your note and will get back to you shortly. Feel free to stop
                      by anytime for your favorite brew!
                    </p>

                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleResetForm}
                        className="inline-flex items-center gap-2 rounded-full border border-espresso-300 bg-white px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-espresso-800 transition hover:bg-espresso-50 active:scale-95"
                      >
                        Send another message
                      </button>
                      <Link
                        to="/menu"
                        className="inline-flex items-center gap-2 rounded-full bg-espresso-900 px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-cream transition hover:bg-espresso-800 active:scale-95"
                      >
                        Explore Menu <ArrowRight size={14} />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. CINEMATIC CAFÉ ATMOSPHERE SECTION */}
      {/* ========================================================================= */}
      <section className="relative isolate overflow-hidden bg-espresso-950 px-4 py-24 text-cream sm:px-6 lg:px-8">
        <img
          src="/images/about/brewhaus-cinematic-hero.png"
          alt="Atmosphere at Brewhaus Café"
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-40"
          loading="lazy"
        />
        <video
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-65 mix-blend-luminosity"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster="/images/about/brewhaus-cinematic-hero.png"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
          aria-hidden="true"
        >
          <source src="/BrewHaus.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-espresso-950 via-espresso-950/60 to-espresso-950/80" />

        <motion.div {...reveal} className="mx-auto max-w-3xl text-center">
          <SectionEyebrow light>Come Say Hello</SectionEyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-[0.98] text-cream sm:text-6xl lg:text-7xl">
            The ritual, from the first pour.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-cream/80 sm:text-lg">
            A calm, warm sanctuary designed for slow mornings, afternoon reading, and evening
            conversations over freshly roasted artisanal coffee.
          </p>
          <div className="mt-8 flex items-center justify-center gap-6 text-xs uppercase tracking-[0.2em] text-cream/60">
            <span>Specialty Roasts</span>
            <span>•</span>
            <span>Warm Comfort Food</span>
            <span>•</span>
            <span>Pune, India</span>
          </div>
        </motion.div>
      </section>

      {/* ========================================================================= */}
      {/* 5. LOCATION & MAP SECTION */}
      {/* ========================================================================= */}
      <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Our Location</SectionEyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold text-espresso-950 sm:text-5xl">
              Finding Brewhaus.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-espresso-600 sm:text-base">
              Conveniently located near Camp in Pune. Step inside to escape the city rush.
            </p>
          </div>

          <motion.div
            {...reveal}
            className="relative mt-12 overflow-hidden rounded-[2.5rem] border border-espresso-100 bg-espresso-950 shadow-[0_20px_50px_rgba(26,15,8,0.15)]"
          >
            {/* Map Frame */}
            <div className="relative h-[380px] w-full sm:h-[460px]">
              <iframe
                title="Brewhaus Cafe Location Map"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3783.197771746654!2d73.8765!3d18.518!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2c06830761e0d%3A0x8670868f0f089679!2sCamp%2C%20Pune%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                className="h-full w-full border-0 grayscale-[40%] contrast-110"
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {/* Floating Location Overlay Card */}
            <div className="pointer-events-auto absolute bottom-6 left-6 right-6 sm:bottom-8 sm:left-8 sm:right-auto sm:max-w-md">
              <div className="rounded-3xl border border-white/40 bg-espresso-900/90 p-6 text-cream shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-2 text-brew-300">
                  <Compass size={16} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">
                    Brewhaus Landmark
                  </span>
                </div>
                <h3 className="mt-2 font-display text-2xl font-bold text-cream">
                  12 Market Lane, Near Camp
                </h3>
                <p className="mt-1 text-xs text-cream/70">Pune, Maharashtra, India</p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=12+Market+Lane+Near+Camp+Pune+India"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-cream px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-espresso-950 transition hover:bg-brew-100 active:scale-95"
                  >
                    <span>Get Directions</span>
                    <ExternalLink size={14} />
                  </a>
                  <span className="text-xs text-cream/60">Open today until 11:00 PM</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. CALL TO ACTION SECTION */}
      {/* ========================================================================= */}
      <section className="relative isolate overflow-hidden bg-espresso-950 px-4 py-24 text-center text-cream sm:px-6 sm:py-32 lg:px-8">
        <img
          src="/images/about/brewhaus-story-cup.png"
          alt="Brewhaus Coffee Experience"
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-35"
          loading="lazy"
        />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(154,96,49,0.45),rgba(13,8,4,0.96)_75%)]" />

        <motion.div {...reveal} className="mx-auto max-w-3xl">
          <SectionEyebrow light>Fine Coffee & Dining</SectionEyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-[0.96] text-cream sm:text-6xl lg:text-7xl">
            Visit Brewhaus.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-cream/80 sm:text-lg">
            Enjoy handcrafted coffee, comforting food, and good moments made to last.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 rounded-full bg-cream px-7 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-espresso-900 transition hover:bg-brew-100 active:scale-95"
            >
              View Menu <ArrowRight size={15} />
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-cream backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
            >
              Explore Our Story <ArrowRight size={15} />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ========================================================================= */}
      {/* 7. REFINED BREWHAUS FOOTER */}
      {/* ========================================================================= */}
      <footer className="bg-[#0a0603] px-4 py-12 text-cream/65 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-display text-2xl font-semibold tracking-[0.12em] text-cream">
                BREWHAUS
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-brew-300">
                Fine Coffee & Dining
              </p>
              <p className="mt-3 text-xs text-cream/50">
                12 Market Lane, Near Camp, Pune • Mon-Sun 8AM - 11PM
              </p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm font-medium">
              <Link to="/menu" className="transition hover:text-cream">
                Menu
              </Link>
              <Link to="/about" className="transition hover:text-cream">
                About
              </Link>
              <Link to="/offers" className="transition hover:text-cream">
                Offers
              </Link>
              <Link to="/gallery" className="transition hover:text-cream">
                Gallery
              </Link>
              <Link to="/contact" className="text-cream underline underline-offset-4">
                Contact
              </Link>
            </div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-cream/40 sm:text-left">
            © {new Date().getFullYear()} Brewhaus Café. Handcrafted with passion. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
