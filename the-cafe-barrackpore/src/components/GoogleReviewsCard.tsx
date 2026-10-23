import React from 'react';
import { clientDetails } from '../config/client';
import { useSiteConfig } from '../context/SiteConfigContext';
import { useI18n } from '../i18n';

export const GoogleReviewsCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useI18n();
  const { restaurantConfig } = useSiteConfig();
  const reviewLink = clientDetails.googleReviewLink || clientDetails.googleMapsLink;
  const businessName = restaurantConfig?.businessName || clientDetails.businessName || 'The Cafe';

  return (
    <div
      className={`w-full my-8 p-6 sm:p-8 rounded-3xl bg-surface-container border border-outline/20 shadow-xl transition-all hover:border-primary/30 flex flex-col md:flex-row items-center justify-between gap-6 ${className}`}
      data-testid="google-reviews-card"
    >
      {/* Left: Google Badge, Rating, and Testimonial */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5 max-w-2xl">
        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-md p-2">
          {/* Official Google G Logo */}
          <svg viewBox="0 0 24 24" className="w-8 h-8" aria-label="Google">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <div className="flex text-amber-400 gap-0.5 text-base" aria-label="5 out of 5 stars">
              <span className="material-symbols-outlined text-amber-400 text-lg">star</span>
              <span className="material-symbols-outlined text-amber-400 text-lg">star</span>
              <span className="material-symbols-outlined text-amber-400 text-lg">star</span>
              <span className="material-symbols-outlined text-amber-400 text-lg">star</span>
              <span className="material-symbols-outlined text-amber-400 text-lg">star</span>
            </div>
            <span className="font-mono text-sm font-bold text-on-surface">4.9 / 5.0</span>
            <span className="text-on-surface/40 text-xs">•</span>
            <span className="font-sans text-xs text-primary font-medium tracking-wide">
              {t('footer.googleReviews', '250+ Verified Reviews')}
            </span>
          </div>

          <h3 className="font-serif text-lg sm:text-xl text-on-surface font-normal tracking-tight">
            "{t('gallery.description', 'Unmatched nocturnal atmosphere, artisanal single-origin roast, and hand-stretched pizzas.')}"
          </h3>
          <p className="font-sans text-xs text-on-surface/60 font-light">
            {t('footer.followUs', `Rated 4.9 stars by verified patrons on Google Maps for ${businessName}.`)}
          </p>
        </div>
      </div>

      {/* Right: Interactive CTA button opening Maps Review Link */}
      <a
        href={reviewLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('footer.googleReviews', 'Read or leave a review on Google Maps')}
        className="w-full sm:w-auto h-11 px-6 rounded-full bg-primary hover:opacity-90 active:opacity-95 text-on-primary text-xs font-sans font-semibold uppercase tracking-[0.16em] transition-all flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(var(--color-primary-rgb),0.25)] hover:shadow-[0_4px_16px_rgba(var(--color-primary-rgb),0.4)] active:scale-95 cursor-pointer shrink-0"
      >
        <span>{t('contact.getDirections', 'View on Google Maps')}</span>
        <span className="material-symbols-outlined text-[15px]">open_in_new</span>
      </a>
    </div>
  );
};
