import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../context/UIContext';
import { clientDetails } from '../config/client';

export const ReservationDrawer: React.FC = () => {
  const { isReservationOpen, setIsReservationOpen } = useUI();
  
  const [formData, setFormData] = useState({
    name: '',
    guests: 2,
    date: '',
    time: '19:00',
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGuestChange = (increment: number) => {
    setFormData(prev => ({
      ...prev,
      guests: Math.max(1, Math.min(20, prev.guests + increment))
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const text = `🌟 New Reservation Request 🌟%0A%0AName: ${formData.name}%0AGuests: ${formData.guests}%0ADate: ${formData.date}%0ATime: ${formData.time}%0ANotes: ${formData.notes}`;
    
    // Clean phone number (remove non-digits)
    const cleanPhone = clientDetails.whatsapp.replace(/\D/g, '');
    
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    setIsReservationOpen(false);
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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-[100dvh] w-full sm:w-[450px] glass-panel z-[210] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="font-headline-sm text-xl text-on-surface font-semibold">Book a Table</h2>
                <p className="font-body-sm text-sm text-on-surface-variant mt-1">Reserve your premium dining experience.</p>
              </div>
              <button
                onClick={() => setIsReservationOpen(false)}
                className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar">
              <form id="reservation-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                
                {/* Name */}
                <div className="flex flex-col gap-2">
                  <label className="font-label-sm text-xs uppercase tracking-widest text-on-surface/70">Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    className="w-full bg-surface-container border border-white/10 rounded-xl px-4 py-3 text-on-surface font-body-md focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>

                {/* Guests */}
                <div className="flex flex-col gap-2">
                  <label className="font-label-sm text-xs uppercase tracking-widest text-on-surface/70">Number of Guests</label>
                  <div className="flex items-center justify-between bg-surface-container border border-white/10 rounded-xl px-4 py-2">
                    <button type="button" onClick={() => handleGuestChange(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-on-surface">
                      <span className="material-symbols-outlined">remove</span>
                    </button>
                    <span className="font-headline-sm text-on-surface">{formData.guests}</span>
                    <button type="button" onClick={() => handleGuestChange(1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-on-surface">
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </div>

                {/* Date & Time Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="font-label-sm text-xs uppercase tracking-widest text-on-surface/70">Date</label>
                    <input
                      type="date"
                      name="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.date}
                      onChange={handleChange}
                      className="w-full bg-surface-container border border-white/10 rounded-xl px-4 py-3 text-on-surface font-body-md focus:outline-none focus:border-primary/50 transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-label-sm text-xs uppercase tracking-widest text-on-surface/70">Time</label>
                    <select
                      name="time"
                      required
                      value={formData.time}
                      onChange={handleChange}
                      className="w-full bg-surface-container border border-white/10 rounded-xl px-4 py-3 text-on-surface font-body-md focus:outline-none focus:border-primary/50 transition-colors appearance-none"
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
                <div className="flex flex-col gap-2">
                  <label className="font-label-sm text-xs uppercase tracking-widest text-on-surface/70">Special Requests (Optional)</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="E.g. Birthday celebration, window seat..."
                    rows={3}
                    className="w-full bg-surface-container border border-white/10 rounded-xl px-4 py-3 text-on-surface font-body-md focus:outline-none focus:border-primary/50 transition-colors resize-none"
                  />
                </div>

              </form>
            </div>

            {/* Footer / Submit */}
            <div className="p-6 border-t border-white/10 bg-surface-container-low">
              <button
                type="submit"
                form="reservation-form"
                className="w-full py-4 rounded-xl btn-premium font-label-lg font-semibold uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <span>Confirm on WhatsApp</span>
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
