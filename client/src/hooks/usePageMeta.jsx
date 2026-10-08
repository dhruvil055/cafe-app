import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTenant } from '../context/TenantContext';

/**
 * Hook and Helmet manager for per-route titles and descriptions via react-helmet-async.
 * Formats: "Page | Brand" (50-60 chars) and descriptions (140-160 chars) derived from tenant data.
 * Never hardcodes Brewhaus.
 */
export default function usePageMeta(titleOrOptions = {}, maybeDescription) {
  const { title, description } = typeof titleOrOptions === 'string'
    ? { title: titleOrOptions, description: maybeDescription }
    : (titleOrOptions || {});
  const tenant = useTenant();
  const brandName = tenant?.name || 'Café';
  const fullTitle = title ? `${title} | ${brandName}` : `${brandName} — Fine Coffee & Dining`;
  const shareImage = tenant?.heroImageUrl || tenant?.logoUrl || '';

  useEffect(() => {
    document.title = fullTitle;
    const setMetaTag = (attribute, attrValue, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attribute}="${attrValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attribute, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    if (description) {
      setMetaTag('name', 'description', description);
      setMetaTag('property', 'og:description', description);
      setMetaTag('name', 'twitter:description', description);
    }
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('name', 'twitter:title', fullTitle);
    if (shareImage) {
      setMetaTag('property', 'og:image', shareImage);
      setMetaTag('name', 'twitter:image', shareImage);
    }
  }, [fullTitle, description, shareImage]);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      {shareImage && <meta property="og:image" content={shareImage} />}
      {shareImage && <meta name="twitter:image" content={shareImage} />}
    </Helmet>
  );
}

export function PageMeta({ title, description }) {
  return usePageMeta(title, description);
}
