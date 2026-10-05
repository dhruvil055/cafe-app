import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';

const pages = {
  '/privacy': {
    title: 'Privacy policy',
    sections: [
      ['Information used for orders', 'We use the name, phone number, email address when provided, table, order items, customizations, payment status, and order history needed to prepare and support your order.'],
      ['Payments and account security', 'Online payments are handled by Razorpay. The café does not receive or store full card details. Order status and receipts use an order-specific access link.'],
      ['Optional communications', 'Marketing consent and browser notifications are optional. You can unsubscribe from marketing messages or change notification permissions in your browser settings.'],
      ['Contact', 'For a privacy question or data request, contact the café through the Contact page and include the phone number used for the order.'],
    ],
  },
  '/terms': {
    title: 'Terms of service',
    sections: [
      ['Orders', 'Please review your table, items, variants, add-ons, quantities, and instructions before submitting. An order is received when the site confirms it. The café may contact you if an item is unavailable or an order needs clarification.'],
      ['Menu and prices', 'Menu availability and prices can change. The final payable total is calculated by the server and includes applicable GST shown in your receipt.'],
      ['Payments', 'Online payment status is confirmed by the payment provider and its signed server notification. Pay-at-counter orders are settled with café staff.'],
      ['Use of the service', 'Use the ordering service for genuine café orders and provide accurate contact details so staff can resolve order issues.'],
    ],
  },
  '/refund-policy': {
    title: 'Refund policy',
    sections: [
      ['Requesting help', 'Speak with café staff as soon as possible if you need to cancel or correct an order. Orders already being prepared may not be cancellable.'],
      ['Online payments', 'When a refund is approved, it is submitted to the original payment provider. The provider controls when the credit appears in your account.'],
      ['Pay at counter', 'For a cash refund, café staff will verify the order and record the return of cash.'],
      ['Payment issues', 'If a payment was debited but the order was not confirmed, keep your payment reference and contact the café through the Contact page.'],
    ],
  },
};

export default function LegalPage() {
  const tenant = useTenant();
  const { pathname } = useLocation();
  const page = pages[pathname] || pages['/privacy'];
  useEffect(() => { document.title = `${page.title} | ${tenant.name}`; }, [page.title, tenant.name]);
  return <main className="min-h-[70vh] bg-cream px-4 py-10 text-espresso-900 sm:px-6"><article className="mx-auto max-w-3xl rounded-3xl border border-foam bg-white p-6 shadow-soft sm:p-10"><Link to="/menu" className="text-sm font-semibold text-brew-700 underline-offset-4 hover:underline">← Back to menu</Link><h1 className="mt-6 font-display text-3xl font-bold">{page.title}</h1><p className="mt-2 text-xs text-stone-500">Last updated October 4, 2026</p><div className="mt-8 space-y-6">{page.sections.map(([heading, body]) => <section key={heading}><h2 className="font-display text-xl font-bold">{heading}</h2><p className="mt-2 leading-7 text-stone-700">{body}</p></section>)}</div></article></main>;
}
