import React, { useState, useEffect, useMemo } from 'react';
import { useSiteConfig, type ImageAsset } from '../../context/SiteConfigContext';
import { useNotification } from '../../hooks/useNotification';

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

  const [aboutTitle, setAboutTitle] = useState(
    siteConfig.ourStory.title || 'Crafting Barrackpore’s finest nocturnal escape'
  );
  const [aboutDescription, setAboutDescription] = useState(
    siteConfig.ourStory.description ||
      'We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.'
  );

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
      heroImage !== (siteConfig.hero.src || '/images/hero-bar.webp')
    );
  }, [heroHeading, heroSubtext, heroImage, siteConfig.hero]);

  const isAboutDirty = useMemo(() => {
    return (
      aboutTitle !== (siteConfig.ourStory.title || 'Crafting Barrackpore’s finest nocturnal escape') ||
      aboutDescription !==
        (siteConfig.ourStory.description ||
          'We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated.')
    );
  }, [aboutTitle, aboutDescription, siteConfig.ourStory]);

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

  // Unsaved changes browser prompt
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
          alt: 'The Café Barrackpore Hero Visual',
        });
      } else if (activeTab === 'about') {
        success = await siteConfig.updateSection('ourStory', {
          title: aboutTitle.trim(),
          description: aboutDescription.trim(),
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

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImageCallback: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addNotification('error', 'File Too Large', 'Please select an image smaller than 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setImageCallback(event.target.result);
        addNotification('info', 'Image Preview Ready', `Selected "${file.name}" for preview. Click Save to persist.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReplaceGalleryImage = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addNotification('error', 'File Too Large', 'Please select an image smaller than 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        const next = [...galleryImages];
        next[index] = {
          src: event.target.result,
          alt: `Gallery Photo ${index + 1}`,
        };
        setGalleryImages(next);
        addNotification('info', 'Gallery Photo Replaced', `Photo ${index + 1} updated in preview. Click Save to persist.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const renderSaveButton = (sectionLabel: string) => {
    const isSaving = saveStatus === 'saving';
    const isSaved = saveStatus === 'saved';
    const isError = saveStatus === 'error';

    return (
      <div className="pt-4 border-t border-outline-variant/30 flex items-center justify-between">
        <div className="text-xs">
          {isCurrentTabDirty ? (
            <span className="text-amber-400 font-semibold inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Unsaved changes
            </span>
          ) : (
            <span className="text-outline/70">All changes saved</span>
          )}
        </div>

        <button
          type="submit"
          disabled={isSaving || !isCurrentTabDirty}
          className={`py-2.5 px-6 rounded-full text-xs font-semibold flex items-center gap-2 transition-all shadow ${
            isSaved
              ? 'bg-emerald-600 text-white'
              : isError
              ? 'bg-red-600 text-white'
              : !isCurrentTabDirty
              ? 'bg-surface-container-high text-outline cursor-not-allowed opacity-50'
              : 'bg-primary text-on-primary hover:bg-primary-hover active:scale-95'
          }`}
        >
          {isSaving ? (
            <>
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              <span>Saving...</span>
            </>
          ) : isSaved ? (
            <>
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>Saved</span>
            </>
          ) : isError ? (
            <>
              <span className="material-symbols-outlined text-base">error</span>
              <span>Couldn't save changes. Try again.</span>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-on-surface">Website Content Control Center</h2>
          <p className="text-xs text-outline mt-0.5">
            Edit text, headings, and imagery displayed on the public website with live previews and persistent saves.
          </p>
        </div>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="py-2 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-xs font-semibold text-primary inline-flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <span>Preview Live Website</span>
          <span className="material-symbols-outlined text-sm">open_in_new</span>
        </a>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-1 text-xs">
        {[
          { id: 'hero' as ContentTab, label: 'Homepage Hero', icon: 'home', dirty: isHeroDirty },
          { id: 'about' as ContentTab, label: 'Our Story & Vibe', icon: 'menu_book', dirty: isAboutDirty },
          { id: 'specials' as ContentTab, label: 'Specials Banner', icon: 'stars', dirty: isSpecialsDirty },
          { id: 'gallery' as ContentTab, label: 'Ambiance Gallery', icon: 'photo_library', dirty: isGalleryDirty },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabSwitch(tab.id)}
            className={`px-4 py-2 rounded-full font-semibold inline-flex items-center gap-2 transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-outline hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />}
          </button>
        ))}
      </div>

      {/* Tab 1: Hero Section */}
      {activeTab === 'hero' && (
        <form onSubmit={handleSaveSection} className="space-y-6 max-w-3xl">
          <div className="bg-surface-container border border-outline-variant/40 rounded-3xl p-6 sm:p-8 space-y-4">
            <h3 className="font-serif text-lg font-bold text-on-surface">Hero Section Headline & Visuals</h3>

            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-outline mb-1.5">
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
                className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary font-medium"
              />
            </div>

            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-outline mb-1.5">
                Supporting Subtext
              </label>
              <textarea
                rows={3}
                required
                value={heroSubtext}
                onChange={(e) => {
                  setHeroSubtext(e.target.value);
                  setSaveStatus('idle');
                }}
                className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-outline mb-2">
                Hero Background Image
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-surface-container-high/60 border border-outline-variant/30">
                <img
                  src={heroImage}
                  alt="Hero Preview"
                  className="w-full sm:w-48 h-28 object-cover rounded-xl border border-outline-variant/50 shadow"
                />
                <div className="flex-1 space-y-2 text-left w-full">
                  <p className="text-xs font-semibold text-on-surface">Replace Hero Visual</p>
                  <p className="text-[11px] text-outline leading-tight">
                    Recommended: 1920 × 1080 px WebP/JPG. Max size 5 MB.
                  </p>
                  <label className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-highest border border-outline-variant/60 text-xs font-semibold text-primary cursor-pointer transition-colors">
                    <span className="material-symbols-outlined text-sm">upload</span>
                    Choose New Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        handleImageUpload(e, setHeroImage);
                        setSaveStatus('idle');
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {renderSaveButton('Hero Section')}
          </div>
        </form>
      )}

      {/* Tab 2: About Section */}
      {activeTab === 'about' && (
        <form onSubmit={handleSaveSection} className="space-y-6 max-w-3xl">
          <div className="bg-surface-container border border-outline-variant/40 rounded-3xl p-6 sm:p-8 space-y-4">
            <h3 className="font-serif text-lg font-bold text-on-surface">About Our Story & Atmosphere</h3>

            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-outline mb-1.5">
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
                className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary font-medium"
              />
            </div>

            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-outline mb-1.5">
                Story & Philosophy
              </label>
              <textarea
                rows={4}
                required
                value={aboutDescription}
                onChange={(e) => {
                  setAboutDescription(e.target.value);
                  setSaveStatus('idle');
                }}
                className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary leading-relaxed"
              />
            </div>

            {renderSaveButton('About Section')}
          </div>
        </form>
      )}

      {/* Tab 3: Specials Banner */}
      {activeTab === 'specials' && (
        <form onSubmit={handleSaveSection} className="space-y-6 max-w-3xl">
          <div className="bg-surface-container border border-outline-variant/40 rounded-3xl p-6 sm:p-8 space-y-4">
            <h3 className="font-serif text-lg font-bold text-on-surface">Special Highlights Banner</h3>

            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-outline mb-1.5">
                Banner Headline
              </label>
              <input
                type="text"
                required
                value={specialsTitle}
                onChange={(e) => {
                  setSpecialsTitle(e.target.value);
                  setSaveStatus('idle');
                }}
                className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary font-medium"
              />
            </div>

            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-outline mb-1.5">
                Promotion Details
              </label>
              <textarea
                rows={3}
                required
                value={specialsDescription}
                onChange={(e) => {
                  setSpecialsDescription(e.target.value);
                  setSaveStatus('idle');
                }}
                className="w-full bg-surface-container-high border border-outline-variant/60 rounded-xl px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:border-primary leading-relaxed"
              />
            </div>

            {renderSaveButton('Specials Banner')}
          </div>
        </form>
      )}

      {/* Tab 4: Ambiance Gallery */}
      {activeTab === 'gallery' && (
        <form onSubmit={handleSaveSection} className="space-y-6 max-w-4xl">
          <div className="bg-surface-container border border-outline-variant/40 rounded-3xl p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="font-serif text-lg font-bold text-on-surface">Ambiance Gallery Photos</h3>
              <p className="text-xs text-outline">
                Showcasing the café's interior, lighting, and barista craft on the homepage.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {galleryImages.map((img, idx) => (
                <div
                  key={idx}
                  className="group relative rounded-2xl overflow-hidden border border-outline-variant/40 aspect-square bg-surface-container-high shadow-sm"
                >
                  <img
                    src={img.src}
                    alt={img.alt || `Gallery ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center gap-2">
                    <span className="text-white text-[11px] font-semibold">Photo {idx + 1}</span>
                    <label className="px-3 py-1 rounded-full bg-primary text-on-primary text-[10px] font-semibold cursor-pointer hover:bg-primary-hover transition-colors">
                      Replace Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          handleReplaceGalleryImage(idx, e);
                          setSaveStatus('idle');
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {renderSaveButton('Gallery Photos')}
          </div>
        </form>
      )}
    </div>
  );
};

export default ContentManagement;
