import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '../i18n';
import type { SupportedLanguage, LanguageMeta } from '../i18n/types';
import { useSiteConfig } from '../context/SiteConfigContext';

export interface LanguageSwitcherProps {
  variant?: 'header' | 'mobile' | 'footer' | 'staff' | 'compact';
  className?: string;
  onLanguageChange?: (lang: SupportedLanguage) => void;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'header',
  className = '',
  onLanguageChange,
}) => {
  const { language, availableLanguages, setLanguage, setStaffLanguage, meta, t } = useI18n();
  const { features } = useSiteConfig();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleSelect = useCallback(
    (code: SupportedLanguage) => {
      if (variant === 'staff' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/staff'))) {
        setStaffLanguage(code);
      } else {
        setLanguage(code);
      }
      setIsOpen(false);
      if (onLanguageChange) {
        onLanguageChange(code);
      }
    },
    [setLanguage, setStaffLanguage, variant, onLanguageChange]
  );

  if (features?.language_switcher === false) {
    return null;
  }

  // Footer Variant: Clean inline badge/select with modal or popover
  if (variant === 'footer') {
    return (
      <div ref={containerRef} className={`relative inline-block ${className}`}>
        <button
          type="button"
          data-testid="language-switcher-trigger-footer"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-high/60 border border-outline/30 hover:border-primary/50 text-on-surface hover:text-primary transition-all text-xs font-sans font-medium cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={t('languageSwitcher.selectLanguage', 'Select Language')}
          title={t('languageSwitcher.selectLanguage', 'Select Language')}
        >
          <span className="text-base leading-none" role="img" aria-hidden="true">
            {meta.flag}
          </span>
          <span className="font-medium">{meta.nativeName}</span>
          <span className="material-symbols-outlined text-[16px] text-on-surface/50 transition-transform duration-200">
            {isOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 w-64 max-h-80 overflow-y-auto rounded-2xl bg-[#140D09]/95 backdrop-blur-xl border border-primary/30 shadow-[0_-12px_40px_rgba(0,0,0,0.8)] z-50 p-1.5 scrollbar-thin scrollbar-thumb-primary/20"
              role="listbox"
              aria-label={t('languageSwitcher.selectLanguage', 'Select Language')}
            >
              <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[#D4AF37] border-b border-white/[0.08] mb-1">
                {t('languageSwitcher.selectLanguage', 'Select Language')}
              </div>
              <div className="flex flex-col gap-0.5">
                {availableLanguages.map((lang: LanguageMeta) => {
                  const isSelected = lang.code === language;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      data-testid={`lang-option-${lang.code}`}
                      data-lang-code={lang.code}
                      onClick={() => handleSelect(lang.code)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary/20 text-primary font-semibold border border-primary/40'
                          : 'text-stone-300 hover:text-white hover:bg-white/[0.06]'
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base leading-none" role="img" aria-hidden="true">
                          {lang.flag}
                        </span>
                        <div>
                          <span className="block font-medium">{lang.nativeName}</span>
                          <span className="block text-[10px] text-stone-400 font-sans">{lang.name}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-primary text-[16px]">
                          check
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Mobile Drawer Variant: Grid of flags + names for easy thumb tapping
  if (variant === 'mobile') {
    return (
      <div className={`w-full ${className}`}>
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#D4AF37] mb-2 px-1">
          {t('languageSwitcher.label', 'Language')} / اللغة / भाषा
        </div>
        <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-1.5">
          {availableLanguages.map((lang: LanguageMeta) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer min-h-[44px] ${
                  isSelected
                    ? 'bg-primary/20 text-primary font-bold border border-primary/50 shadow-sm'
                    : 'bg-white/[0.04] text-stone-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
                }`}
                aria-pressed={isSelected}
              >
                <span className="text-base leading-none" role="img" aria-hidden="true">
                  {lang.flag}
                </span>
                <div className="flex flex-col text-left truncate">
                  <span className="truncate leading-tight">{lang.nativeName}</span>
                  <span className="text-[9px] text-stone-400 uppercase tracking-wider">{lang.code}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Header & Staff / Compact Variant: Dropdown Pill
  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        type="button"
        data-testid="language-switcher-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 h-11 px-3 sm:px-3.5 rounded-full border border-outline/20 bg-surface-container/80 hover:border-primary/50 hover:bg-surface-container-high text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer shadow-md min-w-[44px] min-h-[44px] justify-center ${
          variant === 'staff' ? 'h-9 px-2.5 text-xs bg-white/[0.04] border-white/[0.08]' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('languageSwitcher.selectLanguage', 'Select Language')}
        title={`${t('languageSwitcher.currentLanguage', 'Current Language')}: ${meta.nativeName}`}
      >
        <span className="text-base leading-none" role="img" aria-hidden="true">
          {meta.flag}
        </span>
        <span className="text-xs font-semibold tracking-wider uppercase font-mono hidden sm:inline text-primary">
          {meta.code}
        </span>
        <span className="material-symbols-outlined text-[15px] text-on-surface/60 transition-transform duration-200">
          {isOpen ? 'arrow_drop_up' : 'arrow_drop_down'}
        </span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute top-full mt-2 right-0 w-64 max-h-80 overflow-y-auto rounded-2xl bg-[#140D09]/95 backdrop-blur-xl border border-primary/30 shadow-[0_16px_40px_rgba(0,0,0,0.85)] z-50 p-1.5 scrollbar-thin scrollbar-thumb-primary/20"
            role="listbox"
            aria-label={t('languageSwitcher.selectLanguage', 'Select Language')}
          >
            <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[#D4AF37] border-b border-white/[0.08] mb-1 flex items-center justify-between">
              <span>{t('languageSwitcher.selectLanguage', 'Select Language')}</span>
              <span className="text-[9px] text-stone-400">12 Languages</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {availableLanguages.map((lang: LanguageMeta) => {
                const isSelected = lang.code === language;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    data-testid={`lang-option-${lang.code}`}
                    data-lang-code={lang.code}
                    onClick={() => handleSelect(lang.code)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary/20 text-primary font-semibold border border-primary/40'
                        : 'text-stone-300 hover:text-white hover:bg-white/[0.06]'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none" role="img" aria-hidden="true">
                        {lang.flag}
                      </span>
                      <div>
                        <span className="block font-medium">{lang.nativeName}</span>
                        <span className="block text-[10px] text-stone-400 font-sans">{lang.name}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-primary text-[16px]">
                        check
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
