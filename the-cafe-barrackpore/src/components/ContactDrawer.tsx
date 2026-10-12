import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useUI } from '../context/UIContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { clientDetails } from '../config/client';
import {
  submitContactInquiry,
  buildWhatsAppInquiryUrl,
  type InquirySubject,
  type ContactInquiryPayload,
} from '../services/contactService';

export const ContactDrawer: React.FC = () => {
  const { isContactOpen, setIsContactOpen, showToast } = useUI();
  const { restaurantConfig } = useSiteConfig();

  const businessName = restaurantConfig?.businessName || clientDetails.businessName;
  const whatsappNumber = restaurantConfig?.contact?.whatsapp || clientDetails.whatsapp;
  const conciergePhone = restaurantConfig?.contact?.displayPhone || restaurantConfig?.contact?.phone || clientDetails.phone;

  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    email: string;
    subject: InquirySubject;
    message: string;
  }>({
    name: '',
    phone: '',
    email: '',
    subject: 'general',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedRef, setConfirmedRef] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (isContactOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setErrorMessage(null);
      setConfirmedRef(null);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isContactOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isContactOpen) {
        setIsContactOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isContactOpen, setIsContactOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload: ContactInquiryPayload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      };

      const result = await submitContactInquiry(payload);

      if (result.success && result.inquiryRef) {
        setConfirmedRef(result.inquiryRef);
        showToast({
          title: 'Inquiry Sent',
          message: `Your message has been received (${result.inquiryRef}). Our concierge will respond shortly.`,
          type: 'success',
        });
      } else {
        setErrorMessage(result.error || 'Failed to submit inquiry. Please try again.');
      }
    } catch {
      setErrorMessage('A network error occurred. Please contact our concierge directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppDirect = () => {
    if (!confirmedRef) return;
    const url = buildWhatsAppInquiryUrl(formData, confirmedRef, whatsappNumber);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      {isContactOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setIsContactOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <motion.div
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-drawer-title"
            className="relative w-full max-w-lg bg-[#120B08] border-l border-primary/20 text-on-surface shadow-2xl z-10 flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-surface-container/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-primary/40 bg-surface flex items-center justify-center text-primary shadow-sm">
                  <span className="material-symbols-outlined text-xl">contact_support</span>
                </div>
                <div>
                  <h2 id="contact-drawer-title" className="font-serif text-xl sm:text-2xl text-white font-normal">
                    Guest Concierge
                  </h2>
                  <p className="font-sans text-[11px] uppercase tracking-widest text-primary/80">
                    Direct Contact &amp; Inquiries
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsContactOpen(false)}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Close contact drawer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {confirmedRef ? (
                /* Success View */
                <div className="py-8 flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                  </div>
                  <h3 className="font-serif text-2xl text-white font-normal">Inquiry Received</h3>
                  <p className="font-mono text-xs uppercase tracking-widest text-primary font-semibold">
                    Reference: {confirmedRef}
                  </p>
                  <p className="font-sans text-sm text-zinc-400 max-w-sm font-light leading-relaxed">
                    Thank you, <strong className="text-white">{formData.name}</strong>. Your inquiry has been routed to our floor team at {businessName}.
                  </p>

                  <div className="w-full pt-4 space-y-3">
                    <button
                      type="button"
                      onClick={handleWhatsAppDirect}
                      className="w-full h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">forum</span>
                      <span>Continue via WhatsApp Concierge</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsContactOpen(false)}
                      className="w-full h-12 rounded-full border border-white/10 hover:border-white/20 text-zinc-300 text-xs font-semibold uppercase tracking-wider flex items-center justify-center cursor-pointer transition-colors"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              ) : (
                /* Contact Form */
                <form onSubmit={handleSubmit} className="space-y-4">
                  {errorMessage && (
                    <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-red-400 shrink-0">error</span>
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-zinc-300 uppercase tracking-wider">
                      Your Name <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full h-11 px-4 rounded-xl bg-surface-container border border-outline/25 text-on-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-zinc-600"
                    />
                  </div>

                  {/* Phone & Email Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-zinc-300 uppercase tracking-wider">
                        Phone Number <span className="text-primary">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full h-11 px-4 rounded-xl bg-surface-container border border-outline/25 text-on-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-zinc-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-zinc-300 uppercase tracking-wider">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="guest@example.com"
                        className="w-full h-11 px-4 rounded-xl bg-surface-container border border-outline/25 text-on-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-zinc-600"
                      />
                    </div>
                  </div>

                  {/* Subject Dropdown */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-zinc-300 uppercase tracking-wider">
                      Inquiry Category <span className="text-primary">*</span>
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value as InquirySubject })}
                      className="w-full h-11 px-4 rounded-xl bg-surface-container border border-outline/25 text-on-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                    >
                      <option value="general">General Dining &amp; Location Question</option>
                      <option value="event">Private Event &amp; Banqueting</option>
                      <option value="catering">Artisanal Catering Inquiry</option>
                      <option value="feedback">Guest Experience &amp; Feedback</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-zinc-300 uppercase tracking-wider">
                      Your Message <span className="text-primary">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tell us about your event, party size, date preference, or inquiry details..."
                      className="w-full p-4 rounded-xl bg-surface-container border border-outline/25 text-on-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-zinc-600 resize-none leading-relaxed"
                    />
                  </div>

                  {/* Concierge Assurance */}
                  <div className="p-3.5 rounded-xl bg-surface-container-high/40 border border-outline-variant/15 text-zinc-400 text-xs leading-relaxed font-light">
                    <span>Direct Concierge Desk: </span>
                    <a href={`tel:${conciergePhone}`} className="text-primary font-mono hover:underline">
                      {conciergePhone}
                    </a>
                    <span> · We prioritize immediate hospitality responses within operational hours (11:00 AM – 11:30 PM).</span>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-full bg-primary hover:opacity-90 active:opacity-95 text-on-primary text-xs font-semibold uppercase tracking-[0.16em] flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(var(--color-primary-rgb),0.3)] cursor-pointer transition-all disabled:opacity-50 mt-6"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-on-primary border-t-transparent animate-spin" />
                        <span>Sending Message...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Inquiry</span>
                        <span className="material-symbols-outlined text-[16px]">send</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ContactDrawer;
