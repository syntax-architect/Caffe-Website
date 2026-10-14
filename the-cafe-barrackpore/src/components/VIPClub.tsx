import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { getAvifSource } from '../utils/image';
import type { VIPPerk } from '../services/siteContentService';
import { DEFAULT_VIP_PERKS } from '../services/siteContentService';

export const VIPClub: React.FC = () => {
  const { vipClub, restaurantConfig, engineConfig } = useSiteConfig();
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Section visibility check
  if (vipClub?.enabled === false || engineConfig?.sections?.vipClub === false) {
    return null;
  }

  const businessName = restaurantConfig?.businessName || 'VIP';
  const vipImageSrc = vipClub?.src || '/images/vip-nocturnal-circle.jpg';
  const vipImageAlt = vipClub?.alt || `${businessName} Nocturnal VIP Salon`;

  const badge = vipClub?.badge || "PRIVATE MEMBERS' SALON";
  const badgeIcon = vipClub?.badgeIcon || 'hotel_class';
  const eyebrow = vipClub?.eyebrow || "Connoisseurs' Privileges";
  const title = vipClub?.title || 'Join the Nocturnal Circle';
  const titleItalic = vipClub?.titleItalic || 'Nocturnal Circle';
  const subtitle = vipClub?.subtitle ||
    'Receive discreet invitations to weekend acoustic line-ups, secret seasonal chef previews, and priority booth reservations.';

  const perks: VIPPerk[] = (vipClub?.perks && vipClub.perks.length > 0)
    ? vipClub.perks
    : DEFAULT_VIP_PERKS;

  const ctaLabel = vipClub?.ctaLabel || 'Join Privileges';
  const placeholder = vipClub?.placeholder || 'Enter your private email';
  const disclaimer = vipClub?.disclaimer ||
    'Discreet hospitality notifications only • Strictly no spam • Unsubscribe anytime';
  const successTitle = vipClub?.successTitle || 'Welcome to the Inner Circle';
  const successMessage = vipClub?.successMessage ||
    'Your invitation has been recorded. Discreet seasonal invitations will arrive in your private inbox.';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    // Simulate luxury reservation and concierge API intake
    setTimeout(() => {
      setIsLoading(false);
      setIsSubscribed(true);
    }, 700);
  };

  const perkGridClass = perks.length === 2
    ? 'sm:grid-cols-2 max-w-xl'
    : perks.length === 4
    ? 'sm:grid-cols-2 lg:grid-cols-4 max-w-4xl'
    : 'sm:grid-cols-3 max-w-2xl';

  return (
    <section 
      className="w-full pt-14 sm:pt-16 lg:pt-18 pb-10 sm:pb-12 lg:pb-14 bg-background border-t border-outline/15 relative scroll-mt-28 overflow-hidden" 
      id="vip-club"
    >
      {/* 1. Cinematic Ambient Backlighting */}
      {engineConfig?.theme?.ambience?.meshGlow !== false && (
        <>
          <div 
            className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,_rgba(var(--color-primary-rgb),0.08),_transparent_75%)] pointer-events-none" 
            aria-hidden="true" 
          />
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-primary/5 blur-[160px] rounded-full pointer-events-none" 
            aria-hidden="true" 
          />
        </>
      )}

      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Double-Bezel Gold Foil Master Shell with Machined Luxury Depth */}
        <div
          className="group relative rounded-[2.5rem] p-1.5 sm:p-2 bg-gradient-to-b from-primary/55 via-primary-fixed-dim/30 to-primary/50 shadow-[0_35px_90px_rgba(0,0,0,0.85),0_0_50px_rgba(var(--color-primary-rgb),0.18)] ring-1 ring-outline/25"
        >
          {/* Inner Core Enclosure with Integrated Photographic Speakeasy Atmosphere */}
          <div className="relative rounded-[calc(2.5rem-0.5rem)] overflow-hidden bg-surface-obsidian px-5 py-8 sm:px-12 sm:py-14 lg:px-16 lg:py-16 border border-primary/25 flex flex-col items-center text-center gap-6 sm:gap-7 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]">
            
            {/* 2. PHOTOGRAPHIC CINEMATIC BACKGROUND IMAGE */}
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
              <picture>
                {getAvifSource(vipImageSrc) && (
                  <source srcSet={getAvifSource(vipImageSrc)!} type="image/avif" />
                )}
                {vipImageSrc.endsWith('.jpg') && !vipImageSrc.startsWith('http') && (
                  <source srcSet={vipImageSrc.replace(/\.jpg$/, '.webp')} type="image/webp" />
                )}
                <img
                  src={vipImageSrc}
                  alt={vipImageAlt}
                  width="1366"
                  height="768"
                  className="w-full h-full object-cover object-[center_35%] filter brightness-[0.88] contrast-[1.08] saturate-[1.12] scale-[1.02] transition-transform duration-1000 ease-out group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
              </picture>

              {/* Seamless Scrim Overlays: Calibrated for rich visible photography while guaranteeing 100% typography contrast */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black/90" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,0,0,0.40)_0%,_rgba(0,0,0,0.70)_65%,_rgba(0,0,0,0.95)_100%)]" />
              
              {/* Subtle Warmth behind the crest */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[550px] h-[300px] bg-primary/20 blur-[100px] rounded-full" />
            </div>

            {/* Concentric Golden Inner Hairline Frame */}
            <div className="absolute inset-3 sm:inset-4 rounded-[calc(2.5rem-1rem)] border border-primary/20 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" />

            {/* 3. Prestigious Crest & Badge Header */}
            <div className="relative z-10 flex flex-col items-center gap-2.5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-container/90 border border-primary/45 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.7)] text-[10px] tracking-[0.24em] uppercase text-primary font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span>{badge}</span>
              </div>

              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-primary/60 bg-gradient-to-b from-surface-elevated/95 to-surface-container/95 flex items-center justify-center text-primary shadow-[0_0_35px_rgba(var(--color-primary-rgb),0.35)] mt-1 backdrop-blur-md">
                <span className="material-symbols-outlined text-2xl sm:text-3xl font-light text-primary">{badgeIcon}</span>
                <div className="absolute -inset-1 rounded-full border border-primary/25 pointer-events-none" />
              </div>
            </div>

            {/* 4. Luxury Typography Header */}
            <div className="relative z-10 flex flex-col gap-2 max-w-xl">
              <span className="editorial-eyebrow text-primary font-semibold tracking-[0.22em] text-xs">{eyebrow}</span>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] text-[#FAF6F0] font-normal tracking-tight text-balance leading-tight drop-shadow-[0_3px_14px_rgba(0,0,0,0.95)]">
                {title.includes(titleItalic) ? (
                  <>
                    {title.split(titleItalic)[0]}
                    <span className="italic font-light text-primary">{titleItalic}</span>
                    {title.split(titleItalic)[1]}
                  </>
                ) : (
                  <>
                    Join the <span className="italic font-light text-primary">Nocturnal Circle</span>
                  </>
                )}
              </h2>
              <p className="font-sans text-xs sm:text-base text-[#FAF6F0]/90 leading-relaxed font-light mt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                {subtitle}
              </p>
            </div>

            {/* 5. Luxury Perks Double-Bezel Glass Wells */}
            <div className={`relative z-10 grid grid-cols-1 ${perkGridClass} gap-3 sm:gap-4 w-full my-1`}>
              {perks.map((perk) => (
                <div
                  key={perk.id}
                  className="group/perk rounded-2xl p-[1px] bg-gradient-to-b from-outline/30 via-outline/10 to-primary/35 hover:to-primary/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(var(--color-primary-rgb),0.2)]"
                >
                  <div className="rounded-[calc(1rem-1px)] bg-surface-container/90 backdrop-blur-xl p-4 sm:p-5 flex flex-col items-center text-center gap-2 h-full border border-outline/20">
                    <div className="w-10 h-10 rounded-full bg-surface-elevated border border-primary/40 flex items-center justify-center text-primary group-hover/perk:scale-110 group-hover/perk:border-primary transition-all duration-300 shadow-inner">
                      <span className="material-symbols-outlined text-lg sm:text-xl font-light">{perk.icon || 'star'}</span>
                    </div>
                    <span className="font-sans text-xs sm:text-sm font-semibold text-[#FAF6F0] tracking-wide">{perk.title}</span>
                    <span className="font-sans text-[11px] text-[#FAF6F0]/70 font-light">{perk.description}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 6. Subscription Form & Interactive States */}
            <div className="relative z-10 w-full max-w-md mt-1">
              <AnimatePresence mode="wait">
                {isSubscribed ? (
                  <motion.div 
                    key="subscribed"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center gap-2.5 p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-surface-container/95 to-surface-obsidian/95 border border-primary/50 shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_30px_rgba(var(--color-primary-rgb),0.2)] backdrop-blur-xl"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-primary shadow-inner">
                      <span className="material-symbols-outlined text-2xl font-light">verified</span>
                    </div>
                    <h3 className="font-serif text-xl sm:text-2xl text-[#FAF6F0] font-normal">{successTitle}</h3>
                    <p className="font-sans text-xs text-[#FAF6F0]/80 font-light max-w-xs">
                      {successMessage}
                    </p>
                  </motion.div>
                ) : (
                  <motion.form 
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full flex flex-col sm:flex-row gap-3 items-center" 
                    onSubmit={handleSubmit}
                  >
                    <div className="flex-1 w-full relative group/input">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#FAF6F0]/50 group-focus-within/input:text-primary transition-colors">
                        <span className="material-symbols-outlined text-base font-light">mail</span>
                      </div>
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={placeholder} 
                        required
                        className="w-full h-12 bg-surface-container-lowest/90 border border-outline/30 focus:border-primary ring-1 ring-transparent focus:ring-primary/50 rounded-full pl-12 pr-5 text-sm text-[#FAF6F0] placeholder:text-[#FAF6F0]/40 focus:outline-none transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] backdrop-blur-md"
                        aria-label="Email address for VIP Club"
                      />
                    </div>
                    
                    {/* Island Button-in-Button Submission CTA */}
                    <motion.button 
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={isLoading}
                      className="group/btn w-full sm:w-auto h-12 pl-7 pr-2.5 rounded-full bg-primary hover:bg-primary-fixed text-on-primary text-xs font-sans font-bold uppercase tracking-wider transition-colors flex items-center justify-between gap-3 shadow-[0_4px_22px_rgba(var(--color-primary-rgb),0.35)] hover:shadow-[0_8px_32px_rgba(var(--color-primary-rgb),0.55)] disabled:opacity-70 cursor-pointer shrink-0"
                    >
                      {isLoading ? (
                        <span className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin mx-auto" />
                      ) : (
                        <>
                          <span>{ctaLabel}</span>
                          <div className="w-8 h-8 rounded-full bg-on-primary/15 group-hover/btn:bg-on-primary/25 flex items-center justify-center transition-all duration-300 group-hover/btn:translate-x-1">
                            <span className="material-symbols-outlined text-[17px] text-on-primary">
                              arrow_forward
                            </span>
                          </div>
                        </>
                      )}
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            {/* 7. Discreet Trust & Hospitality Badge */}
            <div className="relative z-10 inline-flex items-center gap-2 font-sans text-[11px] text-[#FAF6F0]/60 tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              <span className="material-symbols-outlined text-[14px] text-primary">verified_user</span>
              <span>{disclaimer}</span>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
