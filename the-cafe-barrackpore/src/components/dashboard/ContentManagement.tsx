import React, { useState, useEffect, useMemo } from 'react';
import { useSiteConfig, type ImageAsset } from '../../context/SiteConfigContext';
import { useNotification } from '../../hooks/useNotification';
import { uploadSiteImage } from '../../services/storageService';

type ContentTab = 'hero' | 'about' | 'specials' | 'gallery';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const ContentManagement: React.FC = () => {
  const siteConfig = useSiteConfig();
  const { addNotification } = useNotification();

  const [activeTab, setActiveTab] = useState<ContentTab>('hero');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Form Fields initialized from SiteConfig
  const [heroHeading, setHeroHeading] = useState(
    siteConfig.hero.headline || 'Step Into Barrackpore’s Trendsetting Dining Retreat'
  );
  const [heroSubtext, setHeroSubtext] = useState(
    siteConfig.hero.subtext ||
      'Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.'
  );
  const [heroImage, setHeroImage] = useState(siteConfig.hero.src || '/images/hero-bar.webp');
  const [heroAlt, setHeroAlt] = useState(siteConfig.hero.alt || 'The Café Barrackpore Hero Visual');

  const [aboutTitle, setAboutTitle] = useState(
    siteConfig.ourStory.title || 'Crafting Barrackpore’s finest nocturnal escape'
  );
  const [aboutDescription, setAboutDescription] = useState(
    siteConfig.ourStory.description ||
      'We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.'
  );
  const [aboutAlt, setAboutAlt] = useState(siteConfig.ourStory.alt || 'The Café Barrackpore Interior Sanctuary');

  const [specialsTitle, setSpecialsTitle] = useState(
    siteConfig.specials.title || 'Special Banquet & Hangout Platters'
  );
  const [specialsDescription, setSpecialsDescription] = useState(
    siteConfig.specials.description ||
      'Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.'
  );

  const [galleryImages, setGalleryImages] = useState<ImageAsset[]>(siteConfig.gallery.images);

  // Dirty State computation
  const isHeroDirty = useMemo(() => {
    return (
      heroHeading !== (siteConfig.hero.headline || 'Step Into Barrackpore’s Trendsetting Dining Retreat') ||
      heroSubtext !==
        (siteConfig.hero.subtext ||
          'Where artisan coffee meets handcrafted cocktails & gourmet comfort food in a strictly premium, nocturnal setting.') ||
      heroImage !== (siteConfig.hero.src || '/images/hero-bar.webp') ||
      heroAlt !== (siteConfig.hero.alt || 'The Café Barrackpore Hero Visual')
    );
  }, [heroHeading, heroSubtext, heroImage, heroAlt, siteConfig.hero]);

  const isAboutDirty = useMemo(() => {
    return (
      aboutTitle !== (siteConfig.ourStory.title || 'Crafting Barrackpore’s finest nocturnal escape') ||
      aboutDescription !==
        (siteConfig.ourStory.description ||
          'We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.') ||
      aboutAlt !== (siteConfig.ourStory.alt || 'The Café Barrackpore Interior Sanctuary')
    );
  }, [aboutTitle, aboutDescription, aboutAlt, siteConfig.ourStory]);

  const isSpecialsDirty = useMemo(() => {
    return (
      specialsTitle !== (siteConfig.specials.title || 'Special Banquet & Hangout Platters') ||
      specialsDescription !==
        (siteConfig.specials.description ||
          'Generous sharing platters with sizzling pan-Asian or smoky clay oven selections, made fresh to order.')
    );
  }, [specialsTitle, specialsDescription, siteConfig.specials]);

  const isGalleryDirty = useMemo(() => {
    return JSON.stringify(galleryImages) !== JSON.stringify(siteConfig.gallery.images);
  }, [galleryImages, siteConfig.gallery.images]);

  const isCurrentTabDirty = useMemo(() => {
    if (activeTab === 'hero') return isHeroDirty;
    if (activeTab === 'about') return isAboutDirty;
    if (activeTab === 'specials') return isSpecialsDirty;
    if (activeTab === 'gallery') return isGalleryDirty;
    return false;
  }, [activeTab, isHeroDirty, isAboutDirty, isSpecialsDirty, isGalleryDirty]);

  const isAnyDirty = isHeroDirty || isAboutDirty || isSpecialsDirty || isGalleryDirty;

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
          src: heroImage,
          alt: heroAlt.trim(),
        });
      } else if (activeTab === 'about') {
        success = await siteConfig.updateSection('ourStory', {
          title: aboutTitle.trim(),
          description: aboutDescription.trim(),
          src: siteConfig.ourStory.src,
          alt: aboutAlt.trim(),
        });
      } else if (activeTab === 'specials') {
        success = await siteConfig.updateSection('specials', {
          title: specialsTitle.trim(),
          description: specialsDescription.trim(),
        });
      } else if (activeTab === 'gallery') {
        success = await siteConfig.updateSection('gallery', {
          images: galleryImages,
        });
      }

      if (success) {
        setSaveStatus('saved');
        addNotification(
          'success',
          'Website Content Persisted',
          'Your updates have been securely saved and are immediately live on the customer website.'
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

  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
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

    const result = await uploadSiteImage(file, 'content');
    setIsUploadingImage(false);

    if (result.success && result.url) {
      setImageCallback(result.url);
      addNotification('success', 'Image Uploaded', `"${file.name}" uploaded to site-images storage.`);
    } else {
      addNotification('error', 'Upload Failed', result.error || 'Failed to upload image.');
    }
  };

  const handleReplaceGalleryImage = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addNotification('error', 'File Too Large', 'Please select an image smaller than 5 MB.');
      return;
    }

    setIsUploadingImage(true);
    addNotification('info', 'Uploading Gallery Asset', `Uploading "${file.name}"...`);

    const result = await uploadSiteImage(file, 'gallery');
    setIsUploadingImage(false);

    if (result.success && result.url) {
      const next = [...galleryImages];
      next[index] = {
        src: result.url,
        alt: `Gallery Photo ${index + 1}`,
      };
      setGalleryImages(next);
      addNotification('success', 'Gallery Image Uploaded', `Photo ${index + 1} updated with storage asset.`);
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
            <span className="text-zinc-500 font-mono text-[11px]">All changes synced to website</span>
          )}
        </div>

        <button
          type="submit"
          disabled={isSaving || isUploadingImage || !isCurrentTabDirty}
          className={`py-3 px-6 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
            isSaved
              ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(5,150,105,0.4)]'
              : isError
              ? 'bg-rose-600 text-white'
              : isUploadingImage || !isCurrentTabDirty
              ? 'bg-white/[0.04] text-zinc-600 border border-white/[0.04] cursor-not-allowed'
              : 'bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] hover:shadow-[0_10px_25px_rgba(212,175,55,0.3)] active:scale-95'
          }`}
        >
          {isSaving ? (
            <>
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              <span>Persisting...</span>
            </>
          ) : isUploadingImage ? (
            <>
              <span className="material-symbols-outlined text-base animate-spin">upload</span>
              <span>Uploading Asset...</span>
            </>
          ) : isSaved ? (
            <>
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>Saved Successfully</span>
            </>
          ) : isError ? (
            <>
              <span className="material-symbols-outlined text-base">error</span>
              <span>Save Failed</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">save</span>
              <span>Publish {sectionLabel}</span>
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl">
      {/* COCKPIT HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              Brand Manifest &amp; Creative Studio
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-white mt-1 tracking-tight">
            Website Content Engine
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
            Curate typography, brand storytelling, visual hero assets, and photo galleries rendered on the public storefront.
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

      {/* SECTION TABS */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2 overflow-x-auto scrollbar-none text-xs">
        {[
          { id: 'hero' as ContentTab, label: 'Hero Experience', icon: 'home', dirty: isHeroDirty },
          { id: 'about' as ContentTab, label: 'Brand Story', icon: 'menu_book', dirty: isAboutDirty },
          { id: 'specials' as ContentTab, label: 'Banquets & Specials', icon: 'stars', dirty: isSpecialsDirty },
          { id: 'gallery' as ContentTab, label: 'Ambiance Gallery', icon: 'photo_library', dirty: isGalleryDirty },
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
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">Hero Headline &amp; Visuals</h3>
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
                  Supporting Brand Subtext
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
                  Hero Cinematic Background Visual
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-[#070605] border border-white/[0.08]">
                  <img
                    src={heroImage}
                    alt="Hero Preview"
                    className="w-full sm:w-56 h-32 object-cover rounded-xl border border-white/[0.1] shadow-lg"
                  />
                  <div className="flex-1 space-y-2 text-left w-full">
                    <p className="text-xs font-bold text-white">Replace Cinematic Visual</p>
                    <p className="text-[11px] text-zinc-400 leading-tight">
                      Recommended: 1920 × 1080 px WebP/JPG. High-res nocturnal atmosphere.
                    </p>
                    <label className="inline-block mt-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer">
                      <span>Choose File...</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, (url) => setHeroImage(url))}
                      />
                    </label>
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
                  placeholder="e.g. Artisanal beverage and cocktail bar at The Café Barrackpore"
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white font-medium focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {renderSaveButton('Hero Section')}
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: ABOUT SECTION */}
      {activeTab === 'about' && (
        <form onSubmit={handleSaveSection} className="space-y-6">
          <div className="p-1 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl">
            <div className="p-6 sm:p-8 rounded-[calc(2rem-0.25rem)] bg-[#120F0D] space-y-5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">Hospitality Philosophy</span>
                <h3 className="font-serif text-lg font-bold text-white mt-0.5">Our Story &amp; Nocturnal Vibe</h3>
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
                  rows={5}
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
                <label className="block text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                  Story Image Accessible Alt Text (WCAG Compliance)
                </label>
                <input
                  type="text"
                  required
                  value={aboutAlt}
                  onChange={(e) => {
                    setAboutAlt(e.target.value);
                    setSaveStatus('idle');
                  }}
                  placeholder="e.g. Artisanal espresso pour and sanctuary atmosphere at The Café Barrackpore"
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white font-medium focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {renderSaveButton('Brand Story')}
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: SPECIALS SECTION */}
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
                  rows={4}
                  required
                  value={specialsDescription}
                  onChange={(e) => {
                    setSpecialsDescription(e.target.value);
                    setSaveStatus('idle');
                  }}
                  className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white leading-relaxed focus:outline-none focus:border-[#D4AF37] resize-none"
                />
              </div>

              {renderSaveButton('Specials Section')}
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: GALLERY SECTION */}
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

                    <div className="flex items-center justify-end pt-1">
                      <label className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer">
                        <span>Replace Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleReplaceGalleryImage(idx, e)}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {renderSaveButton('Ambiance Gallery')}
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default ContentManagement;
