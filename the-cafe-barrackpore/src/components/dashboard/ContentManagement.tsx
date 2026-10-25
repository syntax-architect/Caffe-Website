import { useI18n } from '../../i18n';
import React, { useState, useEffect, useMemo } from 'react';
import { useSiteConfig, type ImageAsset } from '../../context/SiteConfigContext';
import { useNotification } from '../../hooks/useNotification';
import { uploadSiteImage } from '../../services/storageService';
import { 
  DEFAULT_STORY_CHAPTERS, 
  type StoryChapter, 
  type SpecialCombo 
} from '../../services/siteContentService';

type ContentTab = 'hero' | 'about' | 'vibe' | 'specials' | 'gallery' | 'vip' | 'branding';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ImageSpecGuideProps {
  sectionTitle: string;
  recommendedResolution: string;
  aspectRatio: string;
  maxFileSize: string;
  recommendedFormats: string;
  framingAdvice: string;
}

export const ImageSpecGuide: React.FC<ImageSpecGuideProps> = ({
  sectionTitle,
  recommendedResolution,
  aspectRatio,
  maxFileSize,
  recommendedFormats,
  framingAdvice,
}) => {
  const { t } = useI18n();
  return (
  <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1A1612] via-[#0E0C0A] to-[#070605] border border-[#D4AF37]/25 shadow-lg space-y-2.5">
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[#D4AF37] text-base">photo_size_select_actual</span>
        <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-[#D4AF37]">
          {sectionTitle} • Image Specification & Asset Guide
        </span>
      </div>
      <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] text-[10px] font-mono border border-[#D4AF37]/20">
        {t('staff.content.best_performance', 'Best Performance')}
      </span>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left pt-1">
      <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
        <p className="text-[9px] uppercase font-mono text-zinc-400">{t('staff.dashboard.resolution', 'Resolution')}</p>
        <p className="text-xs font-bold text-white mt-0.5">{recommendedResolution}</p>
      </div>
      <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
        <p className="text-[9px] uppercase font-mono text-zinc-400">{t('staff.dashboard.aspect_ratio', 'Aspect Ratio')}</p>
        <p className="text-xs font-bold text-[#D4AF37] mt-0.5">{aspectRatio}</p>
      </div>
      <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
        <p className="text-[9px] uppercase font-mono text-zinc-400">{t('staff.dashboard.max_file_size', 'Max File Size')}</p>
        <p className="text-xs font-bold text-emerald-400 mt-0.5">{maxFileSize}</p>
      </div>
      <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05]">
        <p className="text-[9px] uppercase font-mono text-zinc-400">{t('staff.dashboard.formats', 'Formats')}</p>
        <p className="text-xs font-bold text-sky-400 mt-0.5">{recommendedFormats}</p>
      </div>
    </div>

    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans pt-0.5">
      💡 <strong className="text-zinc-200">{t('staff.dashboard.composition_tip', 'Composition Tip:')}</strong> {framingAdvice}
    </p>
  </div>
  );
};

export const ContentManagement: React.FC = () => {
  const { t } = useI18n(); void t;
  const siteConfig = useSiteConfig();
  const { addNotification } = useNotification();
  const currencySymbol = siteConfig.restaurantConfig.currencySymbol || '₹';

  const [activeTab, setActiveTab] = useState<ContentTab>('hero');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // TAB 1: HERO
  const [heroHeading, setHeroHeading] = useState(
    siteConfig.hero.headline || 'Step Into Barrackpore’s Trendsetting Dining Retreat'
  );
  const [heroSubtext, setHeroSubtext] = useState(
    siteConfig.hero.subtext ||
      'Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.'
  );
  const [heroImage, setHeroImage] = useState(siteConfig.hero.src || '/images/hero-cinematic.jpg');
  const [heroAlt, setHeroAlt] = useState(siteConfig.hero.alt || 'The Café Barrackpore — Nocturnal Cocktail & Espresso Lounge');

  // TAB 2: ABOUT / OUR STORY
  const [aboutTitle, setAboutTitle] = useState(
    siteConfig.ourStory.title || 'Crafting Barrackpore’s finest nocturnal escape'
  );
  const [aboutDescription, setAboutDescription] = useState(
    siteConfig.ourStory.description ||
      'Conceived as an antidote to urban rush, The Café Barrackpore reimagines colonial Bengal heritage into an intimate, contemporary nocturnal haven where time gently slows down.'
  );
  const [aboutImage, setAboutImage] = useState(siteConfig.ourStory.src || '/images/story/story-chapter-1.webp');
  const [aboutAlt, setAboutAlt] = useState(siteConfig.ourStory.alt || 'The Café Barrackpore Heritage Nocturnal Salon');
  const [storyChapters, setStoryChapters] = useState<StoryChapter[]>(
    siteConfig.ourStory.chapters && siteConfig.ourStory.chapters.length > 0
      ? siteConfig.ourStory.chapters
      : DEFAULT_STORY_CHAPTERS
  );

  // TAB 3: ATMOSPHERE & VIBE (4 Photos)
  const defaultVibeImages: ImageAsset[] = useMemo(() => [
    { src: '/images/components/comp_img_0_highres.jpg', alt: 'Midnight Velvet Booth Seating' },
    { src: '/images/components/comp_img_2.webp', alt: 'Live Acoustic & Reading Nook' },
    { src: '/images/components/comp_img_3.webp', alt: 'Signature Brew Bar & Mixology' },
    { src: '/images/components/comp_img_1.webp', alt: 'Artisan Platters and Comfort Food' },
  ], []);

  const [vibeImages, setVibeImages] = useState<ImageAsset[]>(
    siteConfig.aboutVibe?.images && siteConfig.aboutVibe.images.length > 0
      ? siteConfig.aboutVibe.images
      : defaultVibeImages
  );

  // TAB 4: CHEF'S SPECIALS & PLATTERS
  const defaultCombos: SpecialCombo[] = useMemo(() => [
    {
      id: 'combo-chinese-platter',
      name: 'Chinese Platter',
      category: 'mains-platters',
      diet: 'nv',
      price: 380,
      badge: 'CHINESE BANQUET',
      serves: '2–3 Guests',
      description: 'Delicate steamed momos, golden spring rolls & wok-tossed spicy chilli bites.',
      image: '/images/platters/platter-chinese.webp',
    },
    {
      id: 'combo-tandoori-platter',
      name: 'Tandoori Platter',
      category: 'mains-platters',
      diet: 'nv',
      price: 450,
      badge: 'TANDOORI ROYALE',
      serves: '2–3 Guests',
      description: 'Smoky clay oven kebabs, succulent tikka, fresh mint chutney & garlic butter naan.',
      image: '/images/platters/platter-tandoori.webp',
    },
    {
      id: 'combo-rice-noodles-bowl',
      name: 'Rice & Noodles Bowl',
      category: 'mains-platters',
      diet: 'all',
      price: 240,
      badge: 'PAN-ASIAN SHARING',
      serves: '1–2 Guests',
      description: 'Wok-tossed Hakka noodles, fragrant fried rice & crispy Manchurian gravy.',
      image: '/images/platters/platter-bowl.webp',
    },
  ], []);

  const [specialsTitle, setSpecialsTitle] = useState(
    siteConfig.specials.title || 'Special Banquet & Hangout Platters'
  );
  const [specialsDescription, setSpecialsDescription] = useState(
    siteConfig.specials.description ||
      'Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.'
  );
  const [specialCombos, setSpecialCombos] = useState<SpecialCombo[]>(
    siteConfig.specials.combos && siteConfig.specials.combos.length > 0
      ? siteConfig.specials.combos
      : defaultCombos
  );

  // TAB 5: AMBIANCE GALLERY (4 Photos)
  const [galleryImages, setGalleryImages] = useState<ImageAsset[]>(siteConfig.gallery.images);

  // TAB 6: VIP CLUB & SPEAKEASY SALON (1 Photo)
  const [vipTitle, setVipTitle] = useState(
    siteConfig.vipClub?.title || 'The Nocturnal Society'
  );
  const [vipSubtitle, setVipSubtitle] = useState(
    siteConfig.vipClub?.subtitle ||
      'An intimate speakeasy membership for Barrackpore’s discerning patrons.'
  );
  const [vipImage, setVipImage] = useState(siteConfig.vipClub?.src || '/images/vip-nocturnal-circle.jpg');
  const [vipAlt, setVipAlt] = useState(siteConfig.vipClub?.alt || 'The Café Barrackpore Nocturnal VIP Salon');

  // TAB 7: BRAND IDENTITY & LOGO
  const [brandLogo, setBrandLogo] = useState(siteConfig.logoUrl || '/logo.webp');
  const [brandLogoAlt, setBrandLogoAlt] = useState('The Café Barrackpore Crest');

  // Sync state if siteConfig changes from background fetch
  useEffect(() => {
    if (siteConfig.hero.src) setHeroImage(siteConfig.hero.src);
    if (siteConfig.hero.headline) setHeroHeading(siteConfig.hero.headline);
    if (siteConfig.hero.subtext) setHeroSubtext(siteConfig.hero.subtext);
    if (siteConfig.hero.alt) setHeroAlt(siteConfig.hero.alt);

    if (siteConfig.ourStory.src) setAboutImage(siteConfig.ourStory.src);
    if (siteConfig.ourStory.title) setAboutTitle(siteConfig.ourStory.title);
    if (siteConfig.ourStory.description) setAboutDescription(siteConfig.ourStory.description);
    if (siteConfig.ourStory.alt) setAboutAlt(siteConfig.ourStory.alt);
    if (siteConfig.ourStory.chapters && siteConfig.ourStory.chapters.length > 0) {
      setStoryChapters(siteConfig.ourStory.chapters);
    }

    if (siteConfig.aboutVibe?.images && siteConfig.aboutVibe.images.length > 0) {
      setVibeImages(siteConfig.aboutVibe.images);
    }

    if (siteConfig.specials.title) setSpecialsTitle(siteConfig.specials.title);
    if (siteConfig.specials.description) setSpecialsDescription(siteConfig.specials.description);
    if (siteConfig.specials.combos && siteConfig.specials.combos.length > 0) {
      setSpecialCombos(siteConfig.specials.combos);
    }

    if (siteConfig.gallery?.images) setGalleryImages(siteConfig.gallery.images);
    if (siteConfig.vipClub?.src) setVipImage(siteConfig.vipClub.src);
    if (siteConfig.vipClub?.title) setVipTitle(siteConfig.vipClub.title);
    if (siteConfig.vipClub?.subtitle) setVipSubtitle(siteConfig.vipClub.subtitle);
    if (siteConfig.vipClub?.alt) setVipAlt(siteConfig.vipClub.alt);
    if (siteConfig.logoUrl) setBrandLogo(siteConfig.logoUrl);
  }, [siteConfig]);

  // Dirty State computation
  const isHeroDirty = useMemo(() => {
    return (
      heroHeading !== (siteConfig.hero.headline || 'Step Into Barrackpore’s Trendsetting Dining Retreat') ||
      heroSubtext !== (siteConfig.hero.subtext || 'Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.') ||
      heroImage !== (siteConfig.hero.src || '/images/hero-cinematic.jpg') ||
      heroAlt !== (siteConfig.hero.alt || 'The Café Barrackpore — Nocturnal Cocktail & Espresso Lounge')
    );
  }, [heroHeading, heroSubtext, heroImage, heroAlt, siteConfig.hero]);

  const isAboutDirty = useMemo(() => {
    const currentChapters = siteConfig.ourStory.chapters && siteConfig.ourStory.chapters.length > 0
      ? siteConfig.ourStory.chapters
      : DEFAULT_STORY_CHAPTERS;
    return (
      aboutTitle !== (siteConfig.ourStory.title || 'Crafting Barrackpore’s finest nocturnal escape') ||
      aboutDescription !== (siteConfig.ourStory.description || 'Conceived as an antidote to urban rush, The Café Barrackpore reimagines colonial Bengal heritage into an intimate, contemporary nocturnal haven where time gently slows down.') ||
      aboutImage !== (siteConfig.ourStory.src || '/images/story/story-chapter-1.webp') ||
      aboutAlt !== (siteConfig.ourStory.alt || 'The Café Barrackpore Heritage Nocturnal Salon') ||
      JSON.stringify(storyChapters) !== JSON.stringify(currentChapters)
    );
  }, [aboutTitle, aboutDescription, aboutImage, aboutAlt, storyChapters, siteConfig.ourStory]);

  const isVibeDirty = useMemo(() => {
    const current = siteConfig.aboutVibe?.images && siteConfig.aboutVibe.images.length > 0
      ? siteConfig.aboutVibe.images
      : defaultVibeImages;
    return JSON.stringify(vibeImages) !== JSON.stringify(current);
  }, [vibeImages, siteConfig.aboutVibe, defaultVibeImages]);

  const isSpecialsDirty = useMemo(() => {
    const currentCombos = siteConfig.specials.combos && siteConfig.specials.combos.length > 0
      ? siteConfig.specials.combos
      : defaultCombos;
    return (
      specialsTitle !== (siteConfig.specials.title || 'Special Banquet & Hangout Platters') ||
      specialsDescription !== (siteConfig.specials.description || 'Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.') ||
      JSON.stringify(specialCombos) !== JSON.stringify(currentCombos)
    );
  }, [specialsTitle, specialsDescription, specialCombos, siteConfig.specials, defaultCombos]);

  const isGalleryDirty = useMemo(() => {
    return JSON.stringify(galleryImages) !== JSON.stringify(siteConfig.gallery.images);
  }, [galleryImages, siteConfig.gallery.images]);

  const isVipDirty = useMemo(() => {
    return (
      vipTitle !== (siteConfig.vipClub?.title || 'The Nocturnal Society') ||
      vipSubtitle !== (siteConfig.vipClub?.subtitle || 'An intimate speakeasy membership for Barrackpore’s discerning patrons.') ||
      vipImage !== (siteConfig.vipClub?.src || '/images/vip-nocturnal-circle.jpg') ||
      vipAlt !== (siteConfig.vipClub?.alt || 'The Café Barrackpore Nocturnal VIP Salon')
    );
  }, [vipTitle, vipSubtitle, vipImage, vipAlt, siteConfig.vipClub]);

  const isBrandingDirty = useMemo(() => {
    return (
      brandLogo !== (siteConfig.logoUrl || '/logo.webp') ||
      brandLogoAlt !== 'The Café Barrackpore Crest'
    );
  }, [brandLogo, brandLogoAlt, siteConfig.logoUrl]);

  const isCurrentTabDirty = useMemo(() => {
    if (activeTab === 'hero') return isHeroDirty;
    if (activeTab === 'about') return isAboutDirty;
    if (activeTab === 'vibe') return isVibeDirty;
    if (activeTab === 'specials') return isSpecialsDirty;
    if (activeTab === 'gallery') return isGalleryDirty;
    if (activeTab === 'vip') return isVipDirty;
    if (activeTab === 'branding') return isBrandingDirty;
    return false;
  }, [activeTab, isHeroDirty, isAboutDirty, isVibeDirty, isSpecialsDirty, isGalleryDirty, isVipDirty, isBrandingDirty]);

  const isAnyDirty = isHeroDirty || isAboutDirty || isVibeDirty || isSpecialsDirty || isGalleryDirty || isVipDirty || isBrandingDirty;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isAnyDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAnyDirty]);

  const handleTabSwitch = (targetTab: ContentTab) => {
    if (isCurrentTabDirty) {
      const confirmLeave = window.confirm(
        'You have unsaved changes in this section. Discard unsaved changes and switch sections?'
      );
      if (!confirmLeave) return;
    }
    setActiveTab(targetTab);
    setSaveStatus('idle');
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveStatus === 'saving') return;

    setSaveStatus('saving');

    let success = false;
    try {
      if (activeTab === 'hero') {
        success = await siteConfig.updateSection('hero', {
          headline: heroHeading.trim(),
          subtext: heroSubtext.trim(),
          src: heroImage.trim(),
          alt: heroAlt.trim(),
        });
      } else if (activeTab === 'about') {
        success = await siteConfig.updateSection('ourStory', {
          title: aboutTitle.trim(),
          description: aboutDescription.trim(),
          src: aboutImage.trim(),
          alt: aboutAlt.trim(),
          chapters: storyChapters,
        });
      } else if (activeTab === 'vibe') {
        success = await siteConfig.updateSection('aboutVibe', {
          images: vibeImages,
        });
      } else if (activeTab === 'specials') {
        success = await siteConfig.updateSection('specials', {
          title: specialsTitle.trim(),
          description: specialsDescription.trim(),
          combos: specialCombos,
        });
      } else if (activeTab === 'gallery') {
        success = await siteConfig.updateSection('gallery', {
          images: galleryImages,
        });
      } else if (activeTab === 'vip') {
        success = await siteConfig.updateSection('vipClub', {
          title: vipTitle.trim(),
          subtitle: vipSubtitle.trim(),
          src: vipImage.trim(),
          alt: vipAlt.trim(),
        });
      } else if (activeTab === 'branding') {
        success = await siteConfig.updateSection('branding', {
          logoUrl: brandLogo.trim(),
          alt: brandLogoAlt.trim(),
        });
      }

      if (success) {
        setSaveStatus('saved');
        addNotification(
          'success',
          'Website Content Persisted',
          'Your updates have been securely saved to Supabase and are immediately live on the customer website.'
        );
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        addNotification('error', 'Save Failed', 'We couldn\'t save these changes. Please try again.');
      }
    } catch {
      setSaveStatus('error');
      addNotification('error', 'Save Failed', 'An error occurred while saving website content.');
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    folder: 'content' | 'gallery' | 'general',
    setImageCallback: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addNotification('error', 'File Too Large', 'Please select an image smaller than 5 MB.');
      return;
    }

    setIsUploadingImage(true);
    addNotification('info', 'Uploading Asset', `Uploading "${file.name}" to storage...`);

    const result = await uploadSiteImage(file, folder);
    setIsUploadingImage(false);

    if (result.success && result.url) {
      setImageCallback(result.url);
      setSaveStatus('idle');
      addNotification('success', 'Image Uploaded', `"${file.name}" uploaded to site-images storage.`);
    } else {
      addNotification('error', 'Upload Failed', result.error || 'Failed to upload image.');
    }
  };

  const renderSaveButton = (sectionLabel: string) => {
    const isSaving = saveStatus === 'saving';
    const isSaved = saveStatus === 'saved';
    const isError = saveStatus === 'error';

    return (
      <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between">
        <div className="text-xs">
          {isCurrentTabDirty ? (
            <span className="text-amber-400 font-mono font-bold inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              {t('staff.content.unsaved_changes_in_this_section', 'Unsaved changes in this section')}
            </span>
          ) : (
            <span className="text-zinc-500 font-mono text-[11px]">{t('staff.dashboard.all_changes_synced_to_supabase', 'All changes synced to Supabase')}</span>
          )}
        </div>

        <button
          type="submit"
          disabled={isSaving || isUploadingImage || !isCurrentTabDirty}
          className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 transition-all cursor-pointer ${
            isSaving
              ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
              : isSaved
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : isError
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              : isCurrentTabDirty
              ? 'bg-[#D4AF37] hover:bg-[#c5a030] text-[#070605] shadow-[0_4px_15px_rgba(212,175,55,0.3)]'
              : 'bg-white/[0.05] text-zinc-500 border border-white/[0.05] cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              <span>{t('staff.dashboard.saving', 'Saving...')}</span>
            </>
          ) : isSaved ? (
            <>
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{t('staff.dashboard.saved_live', 'Saved Live')}</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">save</span>
              <span>Save {sectionLabel}</span>
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 sm:space-y-8 animate-fadeIn">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              Supabase Media & Content Engine
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-white mt-1 tracking-tight">
            {t('staff.content.website_content_engine', 'Website Content Engine')}
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            {t('staff.content.all_customer_facing_visuals_and_', 'All customer-facing visuals and photography are synchronized with Supabase storage and instantly editable without redeploying.')}
          </p>
        </div>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <span>{t('staff.dashboard.preview_live_website', 'Preview Live Website')}</span>
          <span className="material-symbols-outlined text-sm">open_in_new</span>
        </a>
      </div>

      {/* TABS NAVIGATION BAR */}
      <div className="w-full p-1.5 rounded-2xl bg-[#090807] border border-white/[0.08] shadow-xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-1.5">
          {[
            { id: 'hero' as ContentTab, label: 'Hero Visuals', icon: 'wallpaper', dirty: isHeroDirty },
            { id: 'about' as ContentTab, label: 'Our Story', icon: 'auto_stories', dirty: isAboutDirty },
            { id: 'vibe' as ContentTab, label: 'Atmosphere & Vibe', icon: 'local_fire_department', dirty: isVibeDirty },
            { id: 'specials' as ContentTab, label: 'Banquets & Platters', icon: 'dinner_dining', dirty: isSpecialsDirty },
            { id: 'gallery' as ContentTab, label: 'Ambiance Gallery', icon: 'photo_library', dirty: isGalleryDirty },
            { id: 'vip' as ContentTab, label: 'VIP Speakeasy', icon: 'hotel_class', dirty: isVipDirty },
            { id: 'branding' as ContentTab, label: 'Brand & Logo', icon: 'badge', dirty: isBrandingDirty },
          ].map((tab, idx) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabSwitch(tab.id)}
              className={`relative flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-mono text-[10px] sm:text-[11px] uppercase tracking-wider font-bold transition-all cursor-pointer text-center select-none ${
                activeTab === tab.id
                  ? 'bg-[#D4AF37] text-[#070605] shadow-[0_4px_15px_rgba(212,175,55,0.25)] font-black'
                  : 'bg-[#120F0D] text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-white/[0.06]'
              } ${idx === 6 ? 'col-span-2 sm:col-span-2 xl:col-span-1' : ''}`}
            >
              <span className="material-symbols-outlined text-sm sm:text-base shrink-0">{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
              {tab.dirty && (
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${
                    activeTab === tab.id ? 'bg-[#070605]' : 'bg-amber-400'
                  }`}
                  title={t('staff.content.unsaved_changes', 'Unsaved changes')}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: HERO SECTION */}
      {activeTab === 'hero' && (
        <form onSubmit={handleSaveSection} className="space-y-6">
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">{t('staff.dashboard.above_the_fold', 'Above the Fold')}</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">{t('staff.dashboard.hero_cinematic_photography_amp', 'Hero Cinematic Photography & Typography')}</h3>
              </div>

              {/* ASSET SPECIFICATION GUIDE */}
              <ImageSpecGuide
                sectionTitle="Hero Showcase Banner"
                recommendedResolution="1920 × 1080 px (Desktop) • 1080 × 1920 px (Mobile)"
                aspectRatio="16:9 Landscape"
                maxFileSize="Under 500 KB"
                recommendedFormats="WebP (recommended) or JPG"
                framingAdvice="Atmospheric cinematic establishing photograph of the dining retreat or cocktail lounge. Keep the center-left clear of intense visual distractions so the main brand headline remains razor-sharp."
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Left Column: Background Photo & WCAG Alt (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-2">
                      {t('staff.content.hero_cinematic_background_visual', 'Hero Cinematic Background Visual (Supabase Sync)')}
                    </label>
                    <div className="p-4 rounded-2xl bg-[#070605] border border-white/[0.08] space-y-3">
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-white/[0.1] shadow-lg group">
                        <img
                          src={heroImage}
                          alt={heroAlt}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                          <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-mono text-[#D4AF37] border border-[#D4AF37]/30">
                            {t('staff.content.live_hero_photography', 'Live Hero Photography')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                        <label className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">cloud_upload</span>
                          <span>{t('staff.dashboard.upload_file', 'Upload File...')}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(e, 'content', (url) => setHeroImage(url))}
                          />
                        </label>
                        <input
                          type="url"
                          placeholder={t('staff.dashboard.or_enter_public_image_url', 'Or enter public image URL...')}
                          value={heroImage}
                          onChange={(e) => {
                            setHeroImage(e.target.value);
                            setSaveStatus('idle');
                          }}
                          className="flex-1 bg-[#120F0D] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      {t('staff.content.hero_image_accessible_alt_text_w', 'Hero Image Accessible Alt Text (WCAG Compliance)')}
                    </label>
                    <input
                      type="text"
                      required
                      value={heroAlt}
                      onChange={(e) => {
                        setHeroAlt(e.target.value);
                        setSaveStatus('idle');
                      }}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white font-medium focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Right Column: Main Headline & Narrative Copy (5 cols) */}
                <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                        {t('staff.content.hero_headline', 'Hero Headline')}
                      </label>
                      <input
                        type="text"
                        required
                        value={heroHeading}
                        onChange={(e) => {
                          setHeroHeading(e.target.value);
                          setSaveStatus('idle');
                        }}
                        className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white font-medium focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                        {t('staff.content.sub_headline_narrative', 'Sub-Headline Narrative')}
                      </label>
                      <textarea
                        rows={5}
                        required
                        value={heroSubtext}
                        onChange={(e) => {
                          setHeroSubtext(e.target.value);
                          setSaveStatus('idle');
                        }}
                        className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white leading-relaxed focus:outline-none focus:border-[#D4AF37] resize-none"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-black/40 border border-[#D4AF37]/20 flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#D4AF37] text-xl">visibility</span>
                    <div className="text-[11px] leading-tight">
                      <p className="font-bold text-white">{t('staff.dashboard.above_the_fold_showcase', 'Above-The-Fold Showcase')}</p>
                      <p className="text-zinc-400 text-[10px] mt-0.5">{t('staff.dashboard.greets_all_arriving_diners_on_', 'Greets all arriving diners on desktop, tablet, and mobile displays')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {renderSaveButton('Hero Section')}
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: ABOUT / OUR STORY SECTION */}
      {activeTab === 'about' && (
        <form onSubmit={handleSaveSection} className="space-y-6">
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">{t('staff.dashboard.hospitality_philosophy', 'Hospitality Philosophy')}</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">{t('staff.dashboard.our_story_amp_heritage_sanctua', 'Our Story & Heritage Sanctuary')}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t('staff.content.manage_the_flagship_narrative_an', 'Manage the flagship narrative and each of the 3 interactive sticky story chapters.')}
                </p>
              </div>

              {/* ASSET SPECIFICATION GUIDE */}
              <ImageSpecGuide
                sectionTitle="Our Story Chapters (Flagship Carousel)"
                recommendedResolution="1920 × 1080 px"
                aspectRatio="16:9 Landscape"
                maxFileSize="Under 350 KB"
                recommendedFormats="WebP (recommended) or JPG"
                framingAdvice="Keep primary visual subjects towards the center-left (30%–55%) as the frosted dark glass editorial chapter card floats on the right on desktop screens. Ensure warm lighting and rich contrast."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    {t('staff.content.section_headline', 'Section Headline')}
                  </label>
                  <input
                    type="text"
                    required
                    value={aboutTitle}
                    onChange={(e) => {
                      setAboutTitle(e.target.value);
                      setSaveStatus('idle');
                    }}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white font-medium focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    {t('staff.content.fallback_heritage_photo_url_over', 'Fallback Heritage Photo URL (Overview)')}
                  </label>
                  <input
                    type="url"
                    value={aboutImage}
                    onChange={(e) => {
                      setAboutImage(e.target.value);
                      setSaveStatus('idle');
                    }}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white font-medium focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  {t('staff.content.overview_narrative_description', 'Overview Narrative Description')}
                </label>
                <textarea
                  rows={3}
                  required
                  value={aboutDescription}
                  onChange={(e) => {
                    setAboutDescription(e.target.value);
                    setSaveStatus('idle');
                  }}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white leading-relaxed focus:outline-none focus:border-[#D4AF37] resize-none"
                />
              </div>

              {/* DEDICATED 3 STORY CHAPTERS EDITOR */}
              <div className="pt-2 space-y-4">
                <div className="border-t border-white/[0.08] pt-4 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#D4AF37] text-lg">auto_stories</span>
                      <span>{t('staff.dashboard.the_3_interactive_story_chapte', 'The 3 Interactive Story Chapters')}</span>
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {t('staff.content.each_chapter_has_its_own_dedicat', 'Each chapter has its own dedicated high-resolution photo, badge, headline, and narrative.')}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] text-[10px] font-mono font-bold border border-[#D4AF37]/30">
                    3 Chapters Configured
                  </span>
                </div>

                <div className="space-y-5">
                  {storyChapters.map((chapter, idx) => (
                    <div
                      key={chapter.id || idx}
                      className="p-4 sm:p-5 rounded-2xl bg-[#070605] border border-white/[0.08] space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#D4AF37] text-black font-mono text-xs font-bold">
                            Chapter {chapter.step || `0${idx + 1}`}
                          </span>
                          <span className="text-xs font-mono tracking-wider uppercase text-[#D4AF37]">
                            {chapter.badge || `Chapter ${idx + 1}`}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">ID: {chapter.id}</span>
                      </div>

                      {/* Photo Preview & Upload */}
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <div className="relative aspect-video w-full md:w-56 rounded-xl overflow-hidden border border-white/[0.1] bg-black/40 shrink-0 shadow-lg group">
                          <img
                            src={chapter.image}
                            alt={chapter.imageAlt || chapter.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                            <span className="text-[9px] font-mono text-[#D4AF37] bg-black/70 px-2 py-0.5 rounded backdrop-blur-sm">
                              Chapter {idx + 1} Visual
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 w-full space-y-2">
                          <p className="text-xs font-bold text-white">Chapter {idx + 1} Photograph</p>
                          <p className="text-[11px] text-zinc-400">
                            Recommended: 1920 × 1080 px WebP. High aesthetic contrast with amber and dark tones.
                          </p>
                          <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                            <label className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm">cloud_upload</span>
                              <span>{t('staff.dashboard.upload_photo', 'Upload Photo')}</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) =>
                                  handleImageUpload(e, 'content', (url) => {
                                    const next = [...storyChapters];
                                    next[idx] = { ...next[idx], image: url };
                                    setStoryChapters(next);
                                  })
                                }
                              />
                            </label>
                            <input
                              type="url"
                              placeholder={t('staff.dashboard.or_enter_image_url', 'Or enter image URL...')}
                              value={chapter.image}
                              onChange={(e) => {
                                const next = [...storyChapters];
                                next[idx] = { ...next[idx], image: e.target.value };
                                setStoryChapters(next);
                                setSaveStatus('idle');
                              }}
                              className="flex-1 bg-[#120F0D] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Chapter Copy Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                        <div>
                          <label className="block text-[9px] uppercase font-mono text-zinc-400 mb-1">
                            {t('staff.content.chapter_badge', 'Chapter Badge')}
                          </label>
                          <input
                            type="text"
                            value={chapter.badge}
                            onChange={(e) => {
                              const next = [...storyChapters];
                              next[idx] = { ...next[idx], badge: e.target.value };
                              setStoryChapters(next);
                              setSaveStatus('idle');
                            }}
                            className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] uppercase font-mono text-zinc-400 mb-1">
                            {t('staff.content.headline_prefix', 'Headline Prefix')}
                          </label>
                          <input
                            type="text"
                            value={chapter.title}
                            onChange={(e) => {
                              const next = [...storyChapters];
                              next[idx] = { ...next[idx], title: e.target.value };
                              setStoryChapters(next);
                              setSaveStatus('idle');
                            }}
                            className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] uppercase font-mono text-zinc-400 mb-1">
                            {t('staff.content.italic_highlight_word_s', 'Italic Highlight Word(s)')}
                          </label>
                          <input
                            type="text"
                            value={chapter.titleItalic}
                            onChange={(e) => {
                              const next = [...storyChapters];
                              next[idx] = { ...next[idx], titleItalic: e.target.value };
                              setStoryChapters(next);
                              setSaveStatus('idle');
                            }}
                            className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#D4AF37] font-serif italic"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[9px] uppercase font-mono text-zinc-400 mb-1">
                            {t('staff.content.narrative_copy', 'Narrative Copy')}
                          </label>
                          <textarea
                            rows={2}
                            value={chapter.description}
                            onChange={(e) => {
                              const next = [...storyChapters];
                              next[idx] = { ...next[idx], description: e.target.value };
                              setStoryChapters(next);
                              setSaveStatus('idle');
                            }}
                            className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white leading-relaxed resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] uppercase font-mono text-zinc-400 mb-1">
                            Key Highlight / Footnote
                          </label>
                          <input
                            type="text"
                            value={chapter.highlight}
                            onChange={(e) => {
                              const next = [...storyChapters];
                              next[idx] = { ...next[idx], highlight: e.target.value };
                              setStoryChapters(next);
                              setSaveStatus('idle');
                            }}
                            className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase font-mono text-zinc-400 mb-1">
                          {t('staff.content.accessible_alt_text_wcag_complia', 'Accessible Alt Text (WCAG Compliance)')}
                        </label>
                        <input
                          type="text"
                          value={chapter.imageAlt || ''}
                          onChange={(e) => {
                            const next = [...storyChapters];
                            next[idx] = { ...next[idx], imageAlt: e.target.value };
                            setStoryChapters(next);
                            setSaveStatus('idle');
                          }}
                          placeholder={`Descriptive alt text for Chapter ${idx + 1}`}
                          className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {renderSaveButton('Our Story & Chapters')}
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: ATMOSPHERE & VIBE (4 CARDS) */}
      {activeTab === 'vibe' && (
        <form onSubmit={handleSaveSection} className="space-y-6">
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">{t('staff.dashboard.experiential_spaces', 'Experiential Spaces')}</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">{t('staff.dashboard.atmosphere_amp_vibe_photo_card', 'Atmosphere & Vibe Photo Cards')}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  The 4 signature architectural feature cards rendered in the "About & Vibe" section.
                </p>
              </div>

              {/* ASSET SPECIFICATION GUIDE */}
              <ImageSpecGuide
                sectionTitle="Atmosphere & Vibe Feature Cards"
                recommendedResolution="1200 × 900 px (or 1200 × 1200 px)"
                aspectRatio="4:3 Standard or 1:1 Square"
                maxFileSize="Under 250 KB"
                recommendedFormats="WebP (recommended) or JPG"
                framingAdvice="Focus on intimate textural vignettes—sapphire velvet booth stitching, warm tungsten filament bulbs, barista extractions, or hand-painted colonial decor. Avoid ultra-wide distant shots."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-2">
                {vibeImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-[#070605] border border-white/[0.08] flex flex-col justify-between gap-3 shadow-lg"
                  >
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-white/[0.08]">
                      <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-mono text-[#D4AF37] font-bold">
                        Feature Card #{idx + 1}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1">
                      <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-zinc-400">
                        Feature Title / Alt Text
                      </label>
                      <input
                        type="text"
                        value={img.alt}
                        onChange={(e) => {
                          const next = [...vibeImages];
                          next[idx] = { ...next[idx], alt: e.target.value };
                          setVibeImages(next);
                          setSaveStatus('idle');
                        }}
                        placeholder={`Title for card #${idx + 1}`}
                        className="w-full bg-[#120F0D] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <label className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer shrink-0">
                          <span>{t('staff.dashboard.replace_photo', 'Replace Photo')}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleImageUpload(e, 'content', (url) => {
                                const next = [...vibeImages];
                                next[idx] = { ...next[idx], src: url };
                                setVibeImages(next);
                              })
                            }
                          />
                        </label>
                        <input
                          type="url"
                          placeholder={t('staff.dashboard.or_image_url', 'Or image URL...')}
                          value={img.src}
                          onChange={(e) => {
                            const next = [...vibeImages];
                            next[idx] = { ...next[idx], src: e.target.value };
                            setVibeImages(next);
                            setSaveStatus('idle');
                          }}
                          className="flex-1 bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {renderSaveButton('Atmosphere Cards')}
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: CHEF'S SPECIALS & PLATTERS */}
      {activeTab === 'specials' && (
        <form onSubmit={handleSaveSection} className="space-y-6">
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">{t('staff.dashboard.curated_group_feasts', 'Curated Group Feasts')}</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">{t('staff.dashboard.special_banquet_amp_hangout_pl', 'Special Banquet & Hangout Platters')}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t('staff.content.shareable_signature_group_platte', 'Shareable signature group platters displayed on the homepage specials banner.')}
                </p>
              </div>

              {/* ASSET SPECIFICATION GUIDE */}
              <ImageSpecGuide
                sectionTitle="Chef's Specials & Banquet Platters"
                recommendedResolution="1200 × 800 px"
                aspectRatio="3:2 Landscape"
                maxFileSize="Under 250 KB"
                recommendedFormats="WebP (recommended) or JPG"
                framingAdvice="Mouthwatering 45° angle or top-down food photography. Capture generous group-sharing portions on dark stone or rustic wooden tableware with vibrant fresh herbs and steam."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    {t('staff.content.section_headline', 'Section Headline')}
                  </label>
                  <input
                    type="text"
                    required
                    value={specialsTitle}
                    onChange={(e) => {
                      setSpecialsTitle(e.target.value);
                      setSaveStatus('idle');
                    }}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white font-medium focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    {t('staff.content.platters_description', 'Platters Description')}
                  </label>
                  <input
                    type="text"
                    required
                    value={specialsDescription}
                    onChange={(e) => {
                      setSpecialsDescription(e.target.value);
                      setSaveStatus('idle');
                    }}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white leading-relaxed focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Platter Combos List */}
              <div className="space-y-4 pt-3">
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400">
                  {t('staff.content.featured_banquet_platters_3_shar', 'Featured Banquet Platters (3 Sharing Feasts)')}
                </label>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {specialCombos.map((combo, idx) => (
                    <div
                      key={combo.id || idx}
                      className="p-4 rounded-2xl bg-[#070605] border border-white/[0.08] flex flex-col justify-between gap-4 shadow-lg"
                    >
                      <div className="space-y-3">
                        <div className="w-full aspect-[16/10] rounded-xl overflow-hidden bg-black/40 border border-white/[0.1] relative group">
                          <img src={combo.image} alt={combo.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-[10px] font-mono font-bold text-[#D4AF37]">
                            Platter #{idx + 1}
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <div>
                            <label className="block text-[9px] uppercase font-mono text-zinc-400 mb-1">{t('staff.dashboard.dish_name', 'Dish Name')}</label>
                            <input
                              type="text"
                              value={combo.name}
                              onChange={(e) => {
                                const next = [...specialCombos];
                                next[idx] = { ...next[idx], name: e.target.value };
                                setSpecialCombos(next);
                                setSaveStatus('idle');
                              }}
                              className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] uppercase font-mono text-zinc-400 mb-1">{t('staff.dashboard.badge_text', 'Badge Text')}</label>
                              <input
                                type="text"
                                value={combo.badge}
                                onChange={(e) => {
                                  const next = [...specialCombos];
                                  next[idx] = { ...next[idx], badge: e.target.value };
                                  setSpecialCombos(next);
                                  setSaveStatus('idle');
                                }}
                                className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] uppercase font-mono text-zinc-400 mb-1">Price ({currencySymbol})</label>
                              <input
                                type="number"
                                value={combo.price}
                                onChange={(e) => {
                                  const next = [...specialCombos];
                                  next[idx] = { ...next[idx], price: Number(e.target.value) };
                                  setSpecialCombos(next);
                                  setSaveStatus('idle');
                                }}
                                className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#D4AF37] font-bold focus:outline-none focus:border-[#D4AF37]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/[0.06] space-y-2">
                        <label className="w-full py-2 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">cloud_upload</span>
                          <span>{t('staff.dashboard.replace_platter_photo', 'Replace Platter Photo')}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleImageUpload(e, 'content', (url) => {
                                const next = [...specialCombos];
                                next[idx] = { ...next[idx], image: url };
                                setSpecialCombos(next);
                              })
                            }
                          />
                        </label>
                        <input
                          type="url"
                          placeholder={t('staff.dashboard.or_enter_image_url', 'Or enter image URL...')}
                          value={combo.image}
                          onChange={(e) => {
                            const next = [...specialCombos];
                            next[idx] = { ...next[idx], image: e.target.value };
                            setSpecialCombos(next);
                            setSaveStatus('idle');
                          }}
                          className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {renderSaveButton('Specials Section')}
            </div>
          </div>
        </form>
      )}

      {/* TAB 5: GALLERY SECTION */}
      {activeTab === 'gallery' && (
        <form onSubmit={handleSaveSection} className="space-y-6">
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">{t('staff.dashboard.visual_world', 'Visual World')}</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">{t('staff.dashboard.ambiance_amp_interior_gallery', 'Ambiance & Interior Gallery')}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t('staff.content.high_resolution_photo_slots_rend', 'High-resolution photo slots rendered in the interactive customer ambiance carousel.')}
                </p>
              </div>

              {/* ASSET SPECIFICATION GUIDE */}
              <ImageSpecGuide
                sectionTitle="Visual Chronicles Gallery (4 Carousel Slots)"
                recommendedResolution="1920 × 1080 px"
                aspectRatio="16:9 Widescreen"
                maxFileSize="Under 300 KB"
                recommendedFormats="WebP (recommended) or JPG"
                framingAdvice="High-emotion nocturnal moments—couples dining in velvet booths, artisan pizzas emerging from wood flames, golden coffee crema, or acoustic jazz guitarists under warm tungsten lighting."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-2">
                {galleryImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-[#070605] border border-white/[0.08] flex flex-col justify-between gap-3"
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-white/[0.08]">
                      <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-mono text-[#D4AF37] font-bold">
                        Slot #{idx + 1}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1">
                      <label className="text-[9px] uppercase font-mono font-bold tracking-wider text-zinc-400">
                        Accessible Alt Text / Description
                      </label>
                      <input
                        type="text"
                        value={img.alt}
                        onChange={(e) => {
                          const next = [...galleryImages];
                          next[idx] = { ...next[idx], alt: e.target.value };
                          setGalleryImages(next);
                          setSaveStatus('idle');
                        }}
                        placeholder={`Description for photo #${idx + 1}`}
                        className="w-full bg-[#120F0D] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <label className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer shrink-0">
                        <span>{t('staff.dashboard.replace_photo', 'Replace Photo')}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            handleImageUpload(e, 'gallery', (url) => {
                              const next = [...galleryImages];
                              next[idx] = { ...next[idx], src: url };
                              setGalleryImages(next);
                            })
                          }
                        />
                      </label>
                      <input
                        type="url"
                        placeholder={t('staff.dashboard.or_enter_image_url', 'Or enter image URL...')}
                        value={img.src}
                        onChange={(e) => {
                          const next = [...galleryImages];
                          next[idx] = { ...next[idx], src: e.target.value };
                          setGalleryImages(next);
                          setSaveStatus('idle');
                        }}
                        className="flex-1 bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {renderSaveButton('Ambiance Gallery')}
            </div>
          </div>
        </form>
      )}

      {/* TAB 6: VIP CLUB & SPEAKEASY SALON */}
      {activeTab === 'vip' && (
        <form onSubmit={handleSaveSection} className="space-y-6">
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">{t('staff.dashboard.private_salon', 'Private Salon')}</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">{t('staff.dashboard.vip_club_amp_speakeasy_sanctua', 'VIP Club & Speakeasy Sanctuary')}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t('staff.content.the_exclusive_speakeasy_salon_sh', 'The exclusive speakeasy salon showcase photo displayed on the homepage.')}
                </p>
              </div>

              {/* ASSET SPECIFICATION GUIDE */}
              <ImageSpecGuide
                sectionTitle="VIP Speakeasy Salon Background"
                recommendedResolution="1920 × 1080 px"
                aspectRatio="16:9 Landscape"
                maxFileSize="Under 350 KB"
                recommendedFormats="WebP (recommended) or JPG"
                framingAdvice="An exclusive, dimly lit private speakeasy lounge with 2200K amber lighting, dark walnut surfaces, and subtle gold accents to evoke elite membership prestige."
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Left Column: VIP Photo Preview & Upload (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-2">
                      {t('staff.content.speakeasy_salon_background_visua', 'Speakeasy Salon Background Visual (Supabase Sync)')}
                    </label>

                    <div className="p-4 rounded-2xl bg-[#070605] border border-white/[0.08] space-y-3">
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-white/[0.1] bg-black/40 group shadow-xl">
                        <img
                          src={vipImage}
                          alt={vipAlt}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                          <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-mono text-[#D4AF37] border border-[#D4AF37]/30">
                            {t('staff.content.live_vip_background_image', 'Live VIP Background Image')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                        <label className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer shrink-0 inline-flex items-center gap-2">
                          <span className="material-symbols-outlined text-base">cloud_upload</span>
                          <span>{t('staff.dashboard.upload_new_photo', 'Upload New Photo...')}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(e, 'content', (url) => setVipImage(url))}
                          />
                        </label>
                        <input
                          type="url"
                          placeholder={t('staff.dashboard.or_enter_public_image_url', 'Or enter public image URL...')}
                          value={vipImage}
                          onChange={(e) => {
                            setVipImage(e.target.value);
                            setSaveStatus('idle');
                          }}
                          className="flex-1 bg-[#120F0D] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      {t('staff.content.photo_accessible_alt_text_wcag_c', 'Photo Accessible Alt Text (WCAG Compliance)')}
                    </label>
                    <input
                      type="text"
                      required
                      value={vipAlt}
                      onChange={(e) => {
                        setVipAlt(e.target.value);
                        setSaveStatus('idle');
                      }}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white font-medium focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Right Column: Salon Typography & Previews (5 cols) */}
                <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                        {t('staff.content.salon_title', 'Salon Title')}
                      </label>
                      <input
                        type="text"
                        required
                        value={vipTitle}
                        onChange={(e) => {
                          setVipTitle(e.target.value);
                          setSaveStatus('idle');
                        }}
                        className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white font-medium focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                        {t('staff.content.salon_subtitle', 'Salon Subtitle')}
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={vipSubtitle}
                        onChange={(e) => {
                          setVipSubtitle(e.target.value);
                          setSaveStatus('idle');
                        }}
                        className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white leading-relaxed focus:outline-none focus:border-[#D4AF37] resize-none"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-[#D4AF37]/20 flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#D4AF37] text-2xl">hotel_class</span>
                    <div className="text-[11px] leading-tight">
                      <p className="font-bold text-white">{t('staff.dashboard.homepage_speakeasy_showcase', 'Homepage Speakeasy Showcase')}</p>
                      <p className="text-zinc-400 text-[10px] mt-1">{t('staff.dashboard.renders_in_the_vip_private_sal', 'Renders in the VIP Private Salon section with direct reservation inquiry hooks')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {renderSaveButton('VIP Speakeasy Salon')}
            </div>
          </div>
        </form>
      )}

      {/* TAB 7: BRAND IDENTITY & LOGO */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveSection} className="space-y-6">
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">{t('staff.dashboard.identity_amp_crest', 'Identity & Crest')}</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">{t('staff.dashboard.brand_logo_amp_official_insign', 'Brand Logo & Official Insignia')}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t('staff.content.synchronized_across_the_header_b', 'Synchronized across the header bar, footer directory, staff login, table QR codes, invoice receipts, and kitchen display.')}
                </p>
              </div>

              {/* ASSET SPECIFICATION GUIDE */}
              <ImageSpecGuide
                sectionTitle="Brand Logo & Official Insignia"
                recommendedResolution="512 × 512 px (or SVG vector)"
                aspectRatio="1:1 Square"
                maxFileSize="Under 150 KB"
                recommendedFormats="Transparent PNG, WebP, or SVG"
                framingAdvice="Export with a 100% transparent background. Use gold, cream, or monochrome white line work so the crest renders cleanly across the dark nocturnal header bar, receipts, and table QR codes."
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Left Column: Logo Visual Preview Box (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-6 rounded-2xl bg-[#070605] border border-white/[0.08] flex flex-col items-center text-center space-y-4 shadow-xl">
                    <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-[#1F1914] to-[#0A0807] border border-[#D4AF37]/40 flex items-center justify-center p-4 shadow-[0_0_30px_rgba(212,175,55,0.22)]">
                      <img
                        src={brandLogo}
                        alt={brandLogoAlt}
                        className="w-full h-full object-contain filter invert contrast-125"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{t('staff.dashboard.active_brand_insignia', 'Active Brand Insignia')}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{t('staff.dashboard.high_contrast_vector_crest', 'High-contrast vector crest')}</p>
                    </div>

                    <div className="w-full space-y-2 pt-2 border-t border-white/[0.06]">
                      <label className="w-full py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer inline-flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm">cloud_upload</span>
                        <span>{t('staff.dashboard.choose_logo_file', 'Choose Logo File...')}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, 'general', (url) => setBrandLogo(url))}
                        />
                      </label>
                      <input
                        type="url"
                        placeholder={t('staff.dashboard.or_enter_public_logo_url', 'Or enter public logo URL...')}
                        value={brandLogo}
                        onChange={(e) => {
                          setBrandLogo(e.target.value);
                          setSaveStatus('idle');
                        }}
                        className="w-full bg-[#120F0D] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Alt Text & Multi-Surface Sync Directory (7 cols) */}
                <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
                  <div>
                    <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      {t('staff.content.logo_accessible_description_alt_', 'Logo Accessible Description (Alt Text)')}
                    </label>
                    <input
                      type="text"
                      required
                      value={brandLogoAlt}
                      onChange={(e) => {
                        setBrandLogoAlt(e.target.value);
                        setSaveStatus('idle');
                      }}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white font-medium focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-[#D4AF37]/20 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <span className="material-symbols-outlined text-[#D4AF37] text-base">sync</span>
                      <span>{t('staff.dashboard.real_time_multi_surface_synchr', 'Real-time Multi-Surface Synchronization')}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {t('staff.content.updating_this_insignia_dynamical', 'Updating this insignia dynamically synchronizes across all operations touchpoints without requiring redeployment:')}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[10px] font-mono">
                      <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-zinc-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{t('staff.dashboard.public_header', 'Public Header')}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-zinc-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{t('staff.dashboard.footer_crest', 'Footer Crest')}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-zinc-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{t('staff.dashboard.staff_terminal', 'Staff Terminal')}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-zinc-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{t('staff.dashboard.table_qr_cards', 'Table QR Cards')}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-zinc-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{t('staff.dashboard.guest_invoices', 'Guest Invoices')}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-zinc-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{t('staff.dashboard.kitchen_display', 'Kitchen Display')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {renderSaveButton('Brand Logo')}
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default ContentManagement;

