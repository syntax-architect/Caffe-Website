import React, { useState, useEffect, useMemo } from 'react';
import { useSiteConfig, type ImageAsset } from '../../context/SiteConfigContext';
import { useNotification } from '../../hooks/useNotification';
import { uploadSiteImage } from '../../services/storageService';
import type { SpecialCombo } from '../../services/siteContentService';

type ContentTab = 'hero' | 'about' | 'vibe' | 'specials' | 'gallery' | 'vip' | 'branding';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const ContentManagement: React.FC = () => {
  const siteConfig = useSiteConfig();
  const { addNotification } = useNotification();

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
      'We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.'
  );
  const [aboutImage, setAboutImage] = useState(siteConfig.ourStory.src || '/images/story-pour.webp');
  const [aboutAlt, setAboutAlt] = useState(siteConfig.ourStory.alt || 'Artisanal Espresso Pour');

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
    return (
      aboutTitle !== (siteConfig.ourStory.title || 'Crafting Barrackpore’s finest nocturnal escape') ||
      aboutDescription !== (siteConfig.ourStory.description || 'We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.') ||
      aboutImage !== (siteConfig.ourStory.src || '/images/story-pour.webp') ||
      aboutAlt !== (siteConfig.ourStory.alt || 'Artisanal Espresso Pour')
    );
  }, [aboutTitle, aboutDescription, aboutImage, aboutAlt, siteConfig.ourStory]);

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
              Unsaved changes in this section
            </span>
          ) : (
            <span className="text-zinc-500 font-mono text-[11px]">All changes synced to Supabase</span>
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
              <span>Saving...</span>
            </>
          ) : isSaved ? (
            <>
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>Saved Live</span>
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
    <div className="space-y-8 animate-fadeIn max-w-4xl">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              Supabase Media &amp; Content Engine
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-white mt-1 tracking-tight">
            Website Content Engine
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
            All customer-facing visuals and photography are synchronized with Supabase storage and instantly editable without redeploying.
          </p>
        </div>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span>Preview Live Website</span>
          <span className="material-symbols-outlined text-sm">open_in_new</span>
        </a>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2 overflow-x-auto scrollbar-none text-xs">
        {[
          { id: 'hero' as ContentTab, label: 'Hero Visuals', icon: 'wallpaper', dirty: isHeroDirty },
          { id: 'about' as ContentTab, label: 'Our Story', icon: 'auto_stories', dirty: isAboutDirty },
          { id: 'vibe' as ContentTab, label: 'Atmosphere & Vibe', icon: 'local_fire_department', dirty: isVibeDirty },
          { id: 'specials' as ContentTab, label: 'Banquets & Platters', icon: 'dinner_dining', dirty: isSpecialsDirty },
          { id: 'gallery' as ContentTab, label: 'Ambiance Gallery', icon: 'photo_library', dirty: isGalleryDirty },
          { id: 'vip' as ContentTab, label: 'VIP Speakeasy Salon', icon: 'hotel_class', dirty: isVipDirty },
          { id: 'branding' as ContentTab, label: 'Brand & Logo', icon: 'badge', dirty: isBrandingDirty },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabSwitch(tab.id)}
            className={`px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-wider font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#D4AF37] text-[#070605] shadow-[0_4px_15px_rgba(212,175,55,0.25)]'
                : 'bg-[#120F0D] text-zinc-400 hover:text-white border border-white/[0.06]'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.dirty && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes" />
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: HERO SECTION */}
      {activeTab === 'hero' && (
        <form onSubmit={handleSaveSection} className="space-y-6">
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">Above the Fold</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">Hero Cinematic Photography &amp; Typography</h3>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Hero Headline
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
                  Sub-Headline Narrative
                </label>
                <textarea
                  rows={3}
                  required
                  value={heroSubtext}
                  onChange={(e) => {
                    setHeroSubtext(e.target.value);
                    setSaveStatus('idle');
                  }}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white leading-relaxed focus:outline-none focus:border-[#D4AF37] resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-2">
                  Hero Cinematic Background Visual (Supabase Sync)
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-[#070605] border border-white/[0.08]">
                  <img
                    src={heroImage}
                    alt="Hero Preview"
                    className="w-full sm:w-56 h-32 object-cover rounded-xl border border-white/[0.1] shadow-lg"
                  />
                  <div className="flex-1 space-y-2 text-left w-full">
                    <p className="text-xs font-bold text-white">Replace Hero Photograph</p>
                    <p className="text-[11px] text-zinc-400 leading-tight">
                      Recommended: High-resolution landscape (16:9 or 3:2) 35mm hospitality photo.
                    </p>
                    <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                      <label className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer shrink-0">
                        <span>Choose File...</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, 'content', (url) => setHeroImage(url))}
                        />
                      </label>
                      <input
                        type="url"
                        placeholder="Or enter public image URL..."
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
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Hero Image Accessible Alt Text (WCAG Compliance)
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

              {renderSaveButton('Hero Section')}
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: ABOUT / OUR STORY SECTION */}
      {activeTab === 'about' && (
        <form onSubmit={handleSaveSection} className="space-y-6">
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">Hospitality Philosophy</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">Our Story &amp; Heritage Sanctuary</h3>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Section Title
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
                  Narrative Description
                </label>
                <textarea
                  rows={4}
                  required
                  value={aboutDescription}
                  onChange={(e) => {
                    setAboutDescription(e.target.value);
                    setSaveStatus('idle');
                  }}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white leading-relaxed focus:outline-none focus:border-[#D4AF37] resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-2">
                  Our Story Heritage Photo (Supabase Sync)
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-[#070605] border border-white/[0.08]">
                  <img
                    src={aboutImage}
                    alt="Story Preview"
                    className="w-full sm:w-44 h-44 object-cover rounded-xl border border-white/[0.1] shadow-lg shrink-0"
                  />
                  <div className="flex-1 space-y-2 text-left w-full">
                    <p className="text-xs font-bold text-white">Replace Heritage Photo</p>
                    <p className="text-[11px] text-zinc-400 leading-tight">
                      Recommended: Portrait or square ratio (4:5 or 1:1), displaying artisanal coffee extraction or interior craftsmanship.
                    </p>
                    <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                      <label className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer shrink-0">
                        <span>Choose File...</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, 'content', (url) => setAboutImage(url))}
                        />
                      </label>
                      <input
                        type="url"
                        placeholder="Or enter public image URL..."
                        value={aboutImage}
                        onChange={(e) => {
                          setAboutImage(e.target.value);
                          setSaveStatus('idle');
                        }}
                        className="flex-1 bg-[#120F0D] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Story Image Accessible Alt Text
                </label>
                <input
                  type="text"
                  required
                  value={aboutAlt}
                  onChange={(e) => {
                    setAboutAlt(e.target.value);
                    setSaveStatus('idle');
                  }}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white font-medium focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {renderSaveButton('Our Story')}
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: ATMOSPHERE & VIBE (4 CARDS) */}
      {activeTab === 'vibe' && (
        <form onSubmit={handleSaveSection} className="space-y-6">
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">Experiential Spaces</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">Atmosphere &amp; Vibe Photo Cards</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  The 4 signature architectural feature cards rendered in the "About &amp; Vibe" section.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {vibeImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-[#070605] border border-white/[0.08] flex flex-col justify-between gap-3"
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
                          <span>Replace Photo</span>
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
                          placeholder="Or image URL..."
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
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">Curated Group Feasts</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">Special Banquet &amp; Hangout Platters</h3>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Section Headline
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
                  Platters Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={specialsDescription}
                  onChange={(e) => {
                    setSpecialsDescription(e.target.value);
                    setSaveStatus('idle');
                  }}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white leading-relaxed focus:outline-none focus:border-[#D4AF37] resize-none"
                />
              </div>

              {/* Platter Combos List */}
              <div className="space-y-4 pt-3">
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400">
                  Featured Banquet Platters (3 Combos)
                </label>

                <div className="space-y-4">
                  {specialCombos.map((combo, idx) => (
                    <div
                      key={combo.id || idx}
                      className="p-4 rounded-2xl bg-[#070605] border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center gap-4"
                    >
                      <div className="w-full md:w-36 h-24 rounded-xl overflow-hidden bg-black/40 border border-white/[0.1] shrink-0 relative">
                        <img src={combo.image} alt={combo.name} className="w-full h-full object-cover" />
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono font-bold text-[#D4AF37]">
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[9px] uppercase font-mono text-zinc-400 mb-1">Dish Name</label>
                          <input
                            type="text"
                            value={combo.name}
                            onChange={(e) => {
                              const next = [...specialCombos];
                              next[idx] = { ...next[idx], name: e.target.value };
                              setSpecialCombos(next);
                              setSaveStatus('idle');
                            }}
                            className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] uppercase font-mono text-zinc-400 mb-1">Badge Text</label>
                          <input
                            type="text"
                            value={combo.badge}
                            onChange={(e) => {
                              const next = [...specialCombos];
                              next[idx] = { ...next[idx], badge: e.target.value };
                              setSpecialCombos(next);
                              setSaveStatus('idle');
                            }}
                            className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] uppercase font-mono text-zinc-400 mb-1">Price (₹)</label>
                          <input
                            type="number"
                            value={combo.price}
                            onChange={(e) => {
                              const next = [...specialCombos];
                              next[idx] = { ...next[idx], price: Number(e.target.value) };
                              setSpecialCombos(next);
                              setSaveStatus('idle');
                            }}
                            className="w-full bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>

                        <div className="sm:col-span-2 md:col-span-3 flex items-center gap-2">
                          <label className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer shrink-0">
                            <span>Replace Platter Photo</span>
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
                            placeholder="Or enter image URL..."
                            value={combo.image}
                            onChange={(e) => {
                              const next = [...specialCombos];
                              next[idx] = { ...next[idx], image: e.target.value };
                              setSpecialCombos(next);
                              setSaveStatus('idle');
                            }}
                            className="flex-1 bg-[#120F0D] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                          />
                        </div>
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
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">Visual World</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">Ambiance &amp; Interior Gallery</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  High-resolution photo slots rendered in the interactive customer ambiance carousel.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
                        <span>Replace Photo</span>
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
                        placeholder="Or enter image URL..."
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
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">Private Salon</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">VIP Club &amp; Speakeasy Sanctuary</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  The exclusive speakeasy salon showcase photo displayed on the homepage.
                </p>
              </div>

              {/* VIP PHOTO PREVIEW & REPLACEMENT */}
              <div className="space-y-3">
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400">
                  Speakeasy Salon Background Image
                </label>

                <div className="relative aspect-[16/9] max-h-72 rounded-2xl overflow-hidden border border-white/[0.1] bg-black/40 group">
                  <img
                    src={vipImage}
                    alt={vipAlt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                    <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-mono text-[#D4AF37] border border-[#D4AF37]/30">
                      Live VIP Background Image
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                  <label className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer shrink-0 inline-flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">cloud_upload</span>
                    <span>Upload New Photo...</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'content', (url) => setVipImage(url))}
                    />
                  </label>
                  <input
                    type="url"
                    placeholder="Or enter public image URL..."
                    value={vipImage}
                    onChange={(e) => {
                      setVipImage(e.target.value);
                      setSaveStatus('idle');
                    }}
                    className="flex-1 bg-[#070605] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Photo Alt Text
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

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Salon Title
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
                  Salon Subtitle
                </label>
                <input
                  type="text"
                  required
                  value={vipSubtitle}
                  onChange={(e) => {
                    setVipSubtitle(e.target.value);
                    setSaveStatus('idle');
                  }}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white font-medium focus:outline-none focus:border-[#D4AF37]"
                />
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
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">Identity &amp; Crest</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">Brand Logo &amp; Official Insignia</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Synchronized across the header bar, footer directory, staff login, table QR codes, invoice receipts, and kitchen display.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-[#070605] border border-white/[0.08]">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#1F1914] to-[#0A0807] border border-[#D4AF37]/40 flex items-center justify-center p-3 shadow-[0_0_25px_rgba(212,175,55,0.18)] shrink-0">
                  <img
                    src={brandLogo}
                    alt={brandLogoAlt}
                    className="w-full h-full object-contain filter invert contrast-125"
                  />
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <p className="text-xs font-bold text-white">Upload Brand Logo</p>
                  <p className="text-[11px] text-zinc-400 leading-tight">
                    Recommended: Transparent PNG, WebP or SVG format. High contrast crest design.
                  </p>
                  <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                    <label className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer shrink-0">
                      <span>Choose Logo File...</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, 'general', (url) => setBrandLogo(url))}
                      />
                    </label>
                    <input
                      type="url"
                      placeholder="Or enter public logo URL..."
                      value={brandLogo}
                      onChange={(e) => {
                        setBrandLogo(e.target.value);
                        setSaveStatus('idle');
                      }}
                      className="flex-1 bg-[#120F0D] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Logo Accessible Description (Alt Text)
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

              {renderSaveButton('Brand Logo')}
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default ContentManagement;
