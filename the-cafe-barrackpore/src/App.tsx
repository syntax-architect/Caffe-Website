import { useEffect, useState, useRef } from 'react';
import codeHtml from './code.html?raw';

export default function App() {
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract just the body content
  let bodyContent = codeHtml
    .match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    ?.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Fix image URLs to point to public/images/
  if (bodyContent) {
    bodyContent = bodyContent.replace(/https:\/\/lh3\.googleusercontent\.com\/[a-zA-Z0-9_\-\/]+/g, (match) => {
      if (match.includes('AB6AXuD_b6MA-Uu_vCE4xxscaRzQ-TGFi8oY1QvPaa-yn23JOlkyMVec18xmucoiLRHrrPFAEtzl2VxJJ36bTYABKg794nUicCTiFpQIdlI5JQ3qKozJhhjvIVYecIsFNVBCKIR7KD1unurLESMs0GKIDH8v8YBwxjekSOzujce3q-pBLOAmEQtcj1pkrF6vTCNetcN9w7sMTracOLcjvmLkOHTlB4fmjx_XWxF999kD3FKdvgRww-OT5iCP3g')) return '/images/cinematic_luxury_interior_photo_of_a_trendy_modern_cafe_lounge_named_the_cafe.png';
      if (match.includes('AEtjO1UoHsnPjWRYBzYOyV8LpwHfURXrRr4DYLI1K6bxDZ6tiiPlhX4mnM5sRZEtlrsipk5wFi_i3O3NjMM329p9Qd-9rtZv1F1Ly-5nK8xvrRhHnpygfFwioH89BoVzw-TiFRyWEm_CTcL2E2hQGFqEi6chn-b2Jg6tZFD9Mrxn5rniyr2bMS1krusdffjJW4TvJmsGrTbFrIkxemZUBQ5EH-JhonRI6tAkgb1p0m6tA_D6uemFrYvV32znE5Bu')) return '/images/cozy_aesthetic_cafe_corner_at_the_cafe_barrackpore_neon_sign_glow_vintage.png';
      if (match.includes('AB6AXuDBtStj29U1h9KJJ-AIq-jf1lTzc7Unbo_VQEVunyZORqA27uNsu1cLJi705Oh4FvUWF6U898XTzLD53JMojnIhYym_SHV3hQgBFs2Btt5gSvSfakhYGeBFy1Kmx9wu1epy4KNPmQaDwRwUHZLIMtGijywo2fFAicOqm4_KiMAV4zNzmUz0IgYhDDBWfu9-z203TEy78uix7kdwM9LvaHfKaBqY-2O3qLQNlRUnAXPPsx-HH-mVTJ35EQ')) return '/images/artisan_mocktail_and_coffee_brewing_bar_at_the_cafe_barrackpore_glowing_neon.png';
      if (match.includes('AB6AXuA6lIJOvdzwHcKYAT8LIaK1unW4B76qHrGISTDn4QmU7MUGlO3v87IXEGWFar1BD4WnbBq9DjpNnPLKYwfZ_S0C9bNBZ8KBQ6c3_V0EY8khhcdD_j_9S84il-p-efaqAg9kQSQyPLZjGMrb0eY85oBe5le5Ps2QYb-QXkXQAXHDOT6BHRodHMo0bDmMQ3wolDvMnRJR8ieRhsekZcpreM3_lKmeYEMQOO5ygsBXk2acoF3ew-Z5tCCAng')) return '/images/high_end_cocktail_and_beverage_photography_of_a_glowing_vibrant_blue_curacao.png';
      if (match.includes('AEtjO1XbnberDH_5Mfp7J9WiJv0laVp9uJVYSvnQ03tfjH_1JUdRMf43a6eoixNFCAJywckvtreR6PvCb7A82-7ZTxuAiEwiUwn0i8WveDq4KwYVqVSuJtft-6NrHHgnpJDYUBQMs9pVY9pAsNv0XZO7jtlz-U1Lwz8RIuhZ4skl4ffuMam4j8P8RtpeW8LoeIoqd4u5ZKBrwhOzVtylnvw9cVN9j2m604-s2vwK9-UV2A13Tv0JBPO5lV493T_N')) return '/images/high_end_culinary_photography_of_a_thin_crust_artisanal_chicken_cheese_pizza.png';
      if (match.includes('AB6AXuDgChETPgDQlkXTYSHuvIhM2BJXxWN-3MWvW7rhNQ0p3QKVDNXgcBjq3sjYznE5yjnvZ_UHGsh7HrbagS_jacch8jg_wIhKeixv0fs0qBjaq0eSxuzPGe3NefwG37k3zuo2UBcnhqI7ZD1D43VyTbBItKNcfyzzIP58X2yMUK5iLQiSwuYHzGOQxnaI5He9Ql655QIAy_Kwo9vKoPI1kurtNT8fUxYjjtr0Ng2-wF7oe1q520Nx9Al0bA')) return '/images/gourmet_cafe_food_photography_flat_lay_gourmet_juicy_chicken_burger_with_melted.png';
      if (match.includes('AB6AXuBLOAw2Auk6qI-1rfomWyNMGYFujjyNpQqJAr8cD2adSPFPdMoimrtTQCd5IXaspp7KNVxKUaFzSNmCTdUEVIWbyFfekrOc0BLWBQGW5ymPKY2yL3GTAMKWY9JMxootlCxdZeH10jHgVB7hdQg19jNS2QUxq3Yro1_mwFFpw0N9Wvu4hbsDl_K6O_zdwuRxMcJ42hN4DWfpiSZXiykJE5lodnqXH76c8GuKnqxiPEJeD976TMcHcTlZ4g')) return '/images/high_end_restaurant_culinary_photography_of_chicken_pahadi_momos_steamed.png';
      if (match.includes('AB6AXuBkjamOdF8Jd7JflGD2k-LVlLv8tN447gco3UWhi87swZ_hmUmFJw07ML6uMhjZ7_y6cAJ4bIu9ki7ZM8luaC46jzD0YKc79dxvc-fn2Mk9dYYqz2-u_smyYMFWJ8slvkMP_OSMXVJb05QUra_xdllIAKOxo3crsr9BZw-QdHeG5kJT5rcHsdnHcLMeiojPxaE1nuJ7VaDa7lW5lq_0tH91hOaYQsskVxMDSFaPeJFbf_xxkBDx-05DBg')) return '/images/high_end_cocktail_and_beverage_photography_of_a_glowing_vibrant_blue_curacao.png';
      return match;
    });
  }

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // 1. Navigation smooth scrolling
    const navLinks = container.querySelectorAll('[data-path]');
    const handleNavClick = (e: Event) => {
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      const path = target.getAttribute('data-path');
      if (path) {
        const targetId = path === 'home' ? 'root' : 
                         path === 'menu-categories' ? 'menu-section' : 
                         path === 'table-reservation' ? 'reserve-section' : path;
        
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    navLinks.forEach(link => link.addEventListener('click', handleNavClick));

    // 2. Add to Cart buttons with real price extraction
    const cartBtns = container.querySelectorAll('.order-btn, [data-cart-bound="true"]');
    const handleAddToCart = (e: Event) => {
      e.preventDefault();
      const btn = e.currentTarget as HTMLElement;
      const card = btn.closest('.menu-item-card') || btn.parentElement?.parentElement;
      
      let itemPrice = 150; // Default fallback
      if (card) {
        // Try to find the price element
        const priceEl = card.querySelector('.text-tertiary');
        if (priceEl && priceEl.textContent) {
          const priceMatch = priceEl.textContent.match(/\d+/);
          if (priceMatch) {
            itemPrice = parseInt(priceMatch[0], 10);
          }
        }
        
        // Show cool animation on button
        const originalHtml = btn.innerHTML;
        btn.classList.add('bg-primary', 'text-on-primary');
        btn.classList.remove('bg-surface-container-high', 'text-on-surface');
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">done</span> Added';
        setTimeout(() => {
          btn.classList.remove('bg-primary', 'text-on-primary');
          btn.classList.add('bg-surface-container-high', 'text-on-surface');
          btn.innerHTML = originalHtml;
        }, 1200);

        // Show toast
        const itemNameEl = card.querySelector('h4, [data-name]');
        const itemName = itemNameEl?.textContent || card.getAttribute('data-name') || 'Item';
        setToastMessage(`Added ${itemName} to your bag! (₹${itemPrice})`);
        setTimeout(() => setToastMessage(null), 3000);
      }

      setCartCount(prev => prev + 1);
      setCartTotal(prev => prev + itemPrice);
    };
    cartBtns.forEach(btn => btn.addEventListener('click', handleAddToCart));

    // 3. Play Vibe Button
    const musicBtn = container.querySelector('#music-toggle-btn');
    const handleMusicToggle = (e: Event) => {
      e.preventDefault();
      setIsPlaying(prev => !prev);
    };
    if (musicBtn) musicBtn.addEventListener('click', handleMusicToggle);

    // 4. Menu Tabs filtering
    const tabs = container.querySelectorAll('.menu-tab-btn');
    const menuItems = container.querySelectorAll('.menu-item-card[data-category]');
    
    // Ensure tabs container is visible since inline style had opacity 0
    const tabsContainer = container.querySelector('#category-tabs') as HTMLElement;
    if (tabsContainer) {
        tabsContainer.style.opacity = '1';
    }

    const handleTabClick = (e: Event) => {
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      const category = target.getAttribute('data-category') || 'all';
      
      tabs.forEach(tab => {
        tab.classList.remove('bg-gradient-to-r', 'from-primary-container', 'to-tertiary-container', 'text-on-primary-container', 'shadow-[0_0_16px_rgba(249,115,22,0.35)]', 'font-semibold');
        tab.classList.add('text-on-surface-variant', 'hover:text-on-surface', 'hover:bg-surface-container-high', 'font-medium');
      });
      target.classList.add('bg-gradient-to-r', 'from-primary-container', 'to-tertiary-container', 'text-on-primary-container', 'shadow-[0_0_16px_rgba(249,115,22,0.35)]', 'font-semibold');
      target.classList.remove('text-on-surface-variant', 'hover:text-on-surface', 'hover:bg-surface-container-high', 'font-medium');

      menuItems.forEach(item => {
        if (category === 'all' || item.getAttribute('data-category') === category) {
          (item as HTMLElement).style.display = '';
        } else {
          (item as HTMLElement).style.display = 'none';
        }
      });
    };
    tabs.forEach(tab => tab.addEventListener('click', handleTabClick));

    // 5. Diet Filters (Veg / Non-Veg)
    const dietBtns = container.querySelectorAll('.diet-btn');
    const handleDietClick = (e: Event) => {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        const diet = target.id.replace('diet-filter-', '');

        dietBtns.forEach(btn => {
            btn.classList.remove('bg-primary-container', 'text-on-primary-container', 'shadow-sm');
            btn.classList.add('text-on-surface-variant', 'hover:text-on-surface');
        });
        target.classList.add('bg-primary-container', 'text-on-primary-container', 'shadow-sm');
        target.classList.remove('text-on-surface-variant', 'hover:text-on-surface');

        menuItems.forEach(item => {
            if (diet === 'all' || item.getAttribute('data-diet') === diet) {
                (item as HTMLElement).style.display = '';
            } else {
                (item as HTMLElement).style.display = 'none';
            }
        });
    };
    dietBtns.forEach(btn => btn.addEventListener('click', handleDietClick));

    // 6. Premium Scroll Animations with Intersection Observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-8');
        }
      });
    }, { threshold: 0.1 });

    // Select all cards and sections we want to animate
    const animateElements = container.querySelectorAll('.menu-item-card, .group.relative.rounded-xl, section h2, section p, .p-space-md.rounded-xl.bg-surface-container-low');
    animateElements.forEach(el => {
      el.classList.add('transition-all', 'duration-700', 'opacity-0', 'translate-y-8');
      observer.observe(el);
    });

    // 7. Scroll-linked Canvas Animation
    const canvas = container.querySelector('#scroll-video-canvas') as HTMLCanvasElement;
    const section = container.querySelector('#scroll-sequence-section') as HTMLElement;
    
    let handleSequenceScroll = () => {};
    
    if (canvas && section) {
      const context = canvas.getContext('2d');
      const frameCount = 40;
      const images: HTMLImageElement[] = [];
      const currentFrame = (index: number) => `/frames/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`;

      if (context) {
        // Preload all frames
        for (let i = 1; i <= frameCount; i++) {
          const img = new Image();
          img.src = currentFrame(i);
          images.push(img);
        }

        images[0].onload = () => {
          context.drawImage(images[0], 0, 0, canvas.width, canvas.height);
        };

        const updateImage = (index: number) => {
          const img = images[index];
          if (img && img.complete && img.naturalHeight !== 0) {
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
        };

        handleSequenceScroll = () => {
          const rect = section.getBoundingClientRect();
          let scrollFraction = 0;
          if (rect.top <= 0) {
             const scrolledInPixels = -rect.top;
             const totalScrollablePixels = rect.height - window.innerHeight;
             scrollFraction = scrolledInPixels / totalScrollablePixels;
          }
          scrollFraction = Math.max(0, Math.min(1, scrollFraction));
          
          const frameIndex = Math.min(frameCount - 1, Math.floor(scrollFraction * frameCount));
          requestAnimationFrame(() => updateImage(frameIndex));

          // Text Animations
          const t1 = container.querySelector('#scroll-text-1') as HTMLElement;
          const t2 = container.querySelector('#scroll-text-2') as HTMLElement;
          const t3 = container.querySelector('#scroll-text-3') as HTMLElement;

          if (t1) {
            if (scrollFraction > 0.1 && scrollFraction < 0.3) {
              t1.style.opacity = '1'; t1.style.transform = 'translateY(0)';
            } else {
              t1.style.opacity = '0'; t1.style.transform = scrollFraction > 0.3 ? 'translateY(-2rem)' : 'translateY(2rem)';
            }
          }
          if (t2) {
            if (scrollFraction > 0.4 && scrollFraction < 0.6) {
              t2.style.opacity = '1'; t2.style.transform = 'translateY(0)';
            } else {
              t2.style.opacity = '0'; t2.style.transform = scrollFraction > 0.6 ? 'translateY(-2rem)' : 'translateY(2rem)';
            }
          }
          if (t3) {
            if (scrollFraction > 0.7 && scrollFraction < 0.95) {
              t3.style.opacity = '1'; t3.style.transform = 'translateY(0)';
            } else {
              t3.style.opacity = '0'; t3.style.transform = scrollFraction > 0.95 ? 'translateY(-2rem)' : 'translateY(2rem)';
            }
          }
        };

        window.addEventListener('scroll', handleSequenceScroll, { passive: true });
      }
    }

    return () => {
      navLinks.forEach(link => link.removeEventListener('click', handleNavClick));
      cartBtns.forEach(btn => btn.removeEventListener('click', handleAddToCart));
      if (musicBtn) musicBtn.removeEventListener('click', handleMusicToggle);
      tabs.forEach(tab => tab.removeEventListener('click', handleTabClick));
      dietBtns.forEach(btn => btn.removeEventListener('click', handleDietClick));
      window.removeEventListener('scroll', handleSequenceScroll);
      observer.disconnect();
    };
  }, [bodyContent]);

  // Sync state back to DOM since it's dangerously set
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Update cart counts and totals everywhere
    const cartCountEls = container.querySelectorAll('#header-cart-count, #floating-cart-count');
    cartCountEls.forEach(el => el.textContent = cartCount.toString());

    const cartItemNumEl = container.querySelector('#cart-item-num');
    if (cartItemNumEl) cartItemNumEl.textContent = cartCount.toString();

    const cartTotalEl = container.querySelector('#cart-total-price');
    if (cartTotalEl) cartTotalEl.textContent = `Total: ₹${cartTotal}`;

    // Update floating cart visibility (hide if empty)
    const floatingCart = container.querySelector('#floating-cart-pill') as HTMLElement;
    if (floatingCart) {
      if (cartCount > 0) {
        floatingCart.classList.remove('translate-y-24', 'opacity-0');
      } else {
        floatingCart.classList.add('translate-y-24', 'opacity-0');
      }
    }

    // Update music button
    const musicBtn = container.querySelector('#music-toggle-btn');
    if (musicBtn) {
      const icon = musicBtn.querySelector('.material-symbols-outlined');
      const text = musicBtn.querySelector('.label-text');
      if (icon) icon.textContent = isPlaying ? 'pause_circle' : 'play_circle';
      if (text) text.textContent = isPlaying ? 'Pause Vibe' : 'Play Vibe';
      
      // Add pulsing glow effect when playing
      if (isPlaying) {
        musicBtn.classList.add('animate-pulse', 'shadow-[0_0_15px_rgba(249,115,22,0.5)]');
      } else {
        musicBtn.classList.remove('animate-pulse', 'shadow-[0_0_15px_rgba(249,115,22,0.5)]');
      }
    }
  }, [cartCount, cartTotal, isPlaying, bodyContent]);

  return (
    <>
      {/* Dynamic Toast Notification */}
      <div 
        className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 pointer-events-none ${toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
      >
        <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-surface-container-highest/90 backdrop-blur-xl border border-primary/30 shadow-[0_4px_24px_rgba(0,0,0,0.4)] text-on-surface font-label-md">
          <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="bg-background font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container"
        dangerouslySetInnerHTML={{ __html: bodyContent || '' }}
      />
    </>
  );
}
