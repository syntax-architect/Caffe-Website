import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../context/UIContext';
import { clientDetails } from '../config/client';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { createReservation } from '../services/reservationService';
import { generateClientReservationRef } from '../utils/orderCalculations';

export const ReservationDrawer: React.FC = () => {
  const { isReservationOpen, setIsReservationOpen } = useUI();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const drawerRef = useFocusTrap(isReservationOpen, () => {
    setIsReservationOpen(false);
    setSubmissionError(null);
  });
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    guests: 2,
    date: '',
    time: '19:00',
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (submissionError) setSubmissionError(null);
  };

  const handleGuestChange = (increment: number) => {
    setFormData(prev => ({
      ...prev,
      guests: Math.max(1, Math.min(20, prev.guests + increment))
    }));
  };

  const dispatchWhatsApp = (ref: string) => {
    const text = `🌟 *THE CAFÉ BARRACKPORE* 🌟%0A*RESERVATION REQUEST: ${ref}*%0A%0A*Name:* ${encodeURIComponent(formData.name.trim())}%0A*Phone:* ${formData.phone.trim()}%0A*Guests:* ${formData.guests}%0A*Date:* ${formData.date}%0A*Time:* ${formData.time}${formData.notes.trim() ? `%0A*Special Requests:* ${encodeURIComponent(formData.notes.trim())}` : ''}%0A%0APlease confirm table availability.`;
    
    // Clean phone number (remove non-digits)
    const cleanPhone = clientDetails.whatsapp.replace(/\D/g, '');
    
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    
    // Reset form and close
    setFormData({
      name: '',
      phone: '',
      guests: 2,
      date: '',
      time: '19:00',
      notes: ''
    });
    setSubmissionError(null);
    setIsReservationOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    const activeRef = generateClientReservationRef();

    try {
      const result = await createReservation({
        reservation_ref: activeRef,
        customer_name: formData.name,
        customer_phone: formData.phone,
        reservation_date: formData.date,
        reservation_time: formData.time,
        party_size: formData.guests,
        special_requests: formData.notes.trim() || null,
      });

      if (result.success) {
        dispatchWhatsApp(result.reservationRef);
      } else {
        setSubmissionError(
          result.error ||
            'Online reservation registration is temporarily unavailable. You can still continue through WhatsApp.'
        );
      }
    } catch (err) {
      console.error('[ReservationDrawer] Submission error:', err);
      setSubmissionError(
        'Online reservation registration is temporarily unavailable. You can still continue through WhatsApp.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isReservationOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
            onClick={() => setIsReservationOpen(false)}
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reservation-drawer-title"
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 h-[100dvh] w-full max-w-[460px] bg-[#130C08]/95 backdrop-blur-2xl border-l border-[#D4AF37]/25 z-[210] flex flex-col focus:outline-none shadow-[-25px_0_60px_rgba(0,0,0,0.85)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#D4AF37]/15 bg-[#160E0A]/80">
              <div>
                <span className="editorial-eyebrow text-[10px] block mb-1">Hospitality Reservations</span>
                <h2 id="reservation-drawer-title" className="font-serif text-2xl text-on-surface font-normal">Book a Table</h2>
                <p className="font-sans text-xs text-on-surface/65 mt-0.5 font-light">Experience intimate dining at Cantonment Barrackpore.</p>
              </div>
              <button
                onClick={() => setIsReservationOpen(false)}
                aria-label="Close reservation drawer"
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-on-surface/70 hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar bg-[#130C08]">
              <form id="reservation-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="res-name" className="font-sans text-[11px] uppercase tracking-wider text-on-surface/75 font-medium">
                    Full Name <span className="text-primary">*</span>
                  </label>
                  <input
                    id="res-name"
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-[#0D0705] border border-white/10 rounded-xl px-4 py-3 text-on-surface font-sans text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40 transition-colors placeholder:text-white/20"
                  />
                </div>

                {/* Phone */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="res-phone" className="font-sans text-[11px] uppercase tracking-wider text-on-surface/75 font-medium">
                    Mobile Number <span className="text-primary">*</span>
                  </label>
                  <input
                    id="res-phone"
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-[#0D0705] border border-white/10 rounded-xl px-4 py-3 text-on-surface font-sans text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40 transition-colors placeholder:text-white/20"
                  />
                </div>

                {/* Guests Stepper */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-[11px] uppercase tracking-wider text-on-surface/75 font-medium">Party Size (Guests)</label>
                  <div className="flex items-center justify-between bg-[#0D0705] border border-white/10 rounded-xl px-4 py-2">
                    <button 
                      type="button" 
                      onClick={() => handleGuestChange(-1)} 
                      aria-label="Decrease guest count" 
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-on-surface/80 hover:text-primary transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">remove</span>
                    </button>
                    <div className="flex items-center gap-1.5 font-serif text-lg text-primary tabular-nums font-medium">
                      <span>{formData.guests}</span>
                      <span className="font-sans text-xs text-on-surface/50 font-normal">
                        {formData.guests === 1 ? 'Guest' : 'Guests'}
                      </span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleGuestChange(1)} 
                      aria-label="Increase guest count" 
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-on-surface/80 hover:text-primary transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                    </button>
                  </div>
                </div>

                {/* Date & Time Row */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="res-date" className="font-sans text-[11px] uppercase tracking-wider text-on-surface/75 font-medium">Date <span className="text-primary">*</span></label>
                    <input
                      id="res-date"
                      type="date"
                      name="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.date}
                      onChange={handleChange}
                      className="w-full bg-[#0D0705] border border-white/10 rounded-xl px-4 py-3 text-on-surface font-sans text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40 transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="res-time" className="font-sans text-[11px] uppercase tracking-wider text-on-surface/75 font-medium">Time Slot <span className="text-primary">*</span></label>
                    <select
                      id="res-time"
                      name="time"
                      required
                      value={formData.time}
                      onChange={handleChange}
                      className="w-full bg-[#0D0705] border border-white/10 rounded-xl px-4 py-3 text-on-surface font-sans text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40 transition-colors cursor-pointer"
                    >
                      <option value="12:00">12:00 PM</option>
                      <option value="12:30">12:30 PM</option>
                      <option value="13:00">1:00 PM</option>
                      <option value="13:30">1:30 PM</option>
                      <option value="14:00">2:00 PM</option>
                      <option value="14:30">2:30 PM</option>
                      <option value="15:00">3:00 PM</option>
                      <option value="18:00">6:00 PM</option>
                      <option value="18:30">6:30 PM</option>
                      <option value="19:00">7:00 PM</option>
                      <option value="19:30">7:30 PM</option>
                      <option value="20:00">8:00 PM</option>
                      <option value="20:30">8:30 PM</option>
                      <option value="21:00">9:00 PM</option>
                      <option value="21:30">9:30 PM</option>
                      <option value="22:00">10:00 PM</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="res-notes" className="font-sans text-[11px] uppercase tracking-wider text-on-surface/75 font-medium">Special Occasion or Seating Request</label>
                  <textarea
                    id="res-notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="e.g. Birthday dinner, private booth preferred, quiet corner..."
                    rows={3}
                    className="w-full bg-[#0D0705] border border-white/10 rounded-xl px-4 py-2.5 text-on-surface font-sans text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40 transition-colors resize-none placeholder:text-white/20"
                  />
                </div>

              </form>
            </div>

            {/* Footer / Submit */}
            <div className="p-6 border-t border-[#D4AF37]/15 bg-[#160E0A]/90">
              {submissionError && (
                <div className="p-4 mb-3 rounded-xl bg-error/10 border border-error/30 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-red-400">
                    <span className="material-symbols-outlined text-base">warning</span>
                    <span>Registration Notice</span>
                  </div>
                  <p className="text-on-surface/80 leading-relaxed font-sans">
                    {submissionError}
                  </p>
                  <button
                    type="button"
                    onClick={() => dispatchWhatsApp(generateClientReservationRef())}
                    className="text-left font-semibold text-primary underline hover:text-primary/80 transition-colors pt-1 cursor-pointer"
                  >
                    Continue directly with WhatsApp reservation ➔
                  </button>
                </div>
              )}

              {/* Island Button-in-Button CTA */}
              <button
                type="submit"
                form="reservation-form"
                disabled={isSubmitting}
                className="group relative w-full h-12 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C5A028] text-[#120B08] font-semibold text-xs tracking-wider uppercase shadow-[0_4px_24px_rgba(212,175,55,0.28)] hover:shadow-[0_6px_32px_rgba(212,175,55,0.45)] transition-all duration-300 flex items-center justify-between pl-7 pr-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isSubmitting ? 'Reserving Table...' : 'Confirm via WhatsApp'}</span>
                <span className="w-8 h-8 rounded-full bg-[#120B08]/15 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                  <span className="material-symbols-outlined text-[15px] text-[#120B08]">send</span>
                </span>
              </button>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
