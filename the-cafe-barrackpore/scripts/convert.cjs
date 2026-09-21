const fs = require('fs');
const HTMLtoJSX = require('htmltojsx');

const converter = new HTMLtoJSX({
  createClass: false,
});

const html = fs.readFileSync('src/code.html', 'utf8');

// Extract the body content
const bodyMatch = html.match(/<body[^>]*>(.*?)<\/body>/si);
if (!bodyMatch) {
  console.error("Could not find body");
  process.exit(1);
}

let bodyContent = bodyMatch[1];

// Remove script tags from body
bodyContent = bodyContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

// Convert to JSX
let jsx = converter.convert(bodyContent);

// Wrap in App component
const appTsx = `import React, { useState } from 'react';

export default function App() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [cartCount, setCartCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleCategoryClick = (e, category) => {
    e.preventDefault();
    setActiveCategory(category);
    // Smooth scroll to menu grid
    document.getElementById('menu-curated-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAddToCart = () => {
    setCartCount(prev => prev + 1);
  };

  const toggleVibe = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNavClick = (e, id) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container">
      ${jsx}
    </div>
  );
}
`;

// 1. Cart Count
let finalTsx = appTsx.replace(
  /<span id="header-cart-count"[^>]*>0<\/span>/g, 
  '<span id="header-cart-count" className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[11px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(249,115,22,0.6)]">{cartCount}</span>'
);

// 1.1 Category Tabs
finalTsx = finalTsx.replace(
  /onClick="setDietFilter\('([^']+)'\)"/g,
  ''
);

// 2. Add to Cart buttons
finalTsx = finalTsx.replace(
  /<button\s+className="order-btn[^>]*data-cart-bound="true">([\s\S]*?)<\/button>/g,
  '<button onClick={handleAddToCart} className="order-btn px-space-md py-2 rounded-xl bg-surface-container-high text-on-surface hover:bg-primary hover:text-on-primary font-label-sm text-xs font-bold transition-all shadow-md flex items-center gap-1.5"><span className="material-symbols-outlined text-base">add_shopping_cart</span> Add</button>'
);

// Add missing specific variations of the add button
finalTsx = finalTsx.replace(
  /<button\s+className="order-btn px-2\.5 py-1[^>]*data-cart-bound="true">([\s\S]*?)<\/button>/g,
  '<button onClick={handleAddToCart} className="order-btn px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface hover:bg-primary hover:text-on-primary font-label-sm text-[11px] font-semibold transition-colors flex items-center gap-1"><span className="material-symbols-outlined text-sm">add</span> Add</button>'
);

// 3. Play Vibe button
finalTsx = finalTsx.replace(
  /<button id="music-toggle-btn"[\s\S]*?<\/button>/,
  `<button id="music-toggle-btn" onClick={toggleVibe} className="px-space-md py-1.5 rounded-lg bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary transition-all font-label-sm text-label-sm flex items-center gap-1.5 shadow-sm">
    <span className="material-symbols-outlined text-base">{isPlaying ? 'pause_circle' : 'play_circle'}</span>
    <span className="label-text font-semibold">{isPlaying ? 'Pause Vibe' : 'Play Vibe'}</span>
  </button>`
);

// 3.5 Navigation Links
finalTsx = finalTsx.replace(
  /<a([^>]*?)data-path="([^"]+)"([^>]*?)>/g,
  '<a$1data-path="$2"$3 onClick={(e) => handleNavClick(e, "$2")}>'
);

// Add missing specific variations of the add button
finalTsx = finalTsx.replace(
  /<button\s+className="order-btn px-2\.5 py-1[^>]*data-cart-bound="true">([\s\S]*?)<\/button>/g,
  '<button onClick={handleAddToCart} className="order-btn px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface hover:bg-primary hover:text-on-primary font-label-sm text-[11px] font-semibold transition-colors flex items-center gap-1"><span className="material-symbols-outlined text-sm">add</span> Add</button>'
);

// 3. Play Vibe button
finalTsx = finalTsx.replace(
  /<button id="music-toggle-btn"[\s\S]*?<\/button>/,
  `<button id="music-toggle-btn" onClick={toggleVibe} className="px-space-md py-1.5 rounded-lg bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary transition-all font-label-sm text-label-sm flex items-center gap-1.5 shadow-sm">
    <span className="material-symbols-outlined text-base">{isPlaying ? 'pause_circle' : 'play_circle'}</span>
    <span className="label-text font-semibold">{isPlaying ? 'Pause Vibe' : 'Play Vibe'}</span>
  </button>`
);

// 4. Update image URLs
finalTsx = finalTsx.replace(/https:\/\/lh3\.googleusercontent\.com\/aida-public\/AB6AXuD_b6MA-Uu_vCE4xxscaRzQ-TGFi8oY1QvPaa-yn23JOlkyMVec18xmucoiLRHrrPFAEtzl2VxJJ36bTYABKg794nUicCTiFpQIdlI5JQ3qKozJhhjvIVYecIsFNVBCKIR7KD1unurLESMs0GKIDH8v8YBwxjekSOzujce3q-pBLOAmEQtcj1pkrF6vTCNetcN9w7sMTracOLcjvmLkOHTlB4fmjx_XWxF999kD3FKdvgRww-OT5iCP3g/g, '/images/cinematic_luxury_interior_photo_of_a_trendy_modern_cafe_lounge_named_the_cafe.png');
finalTsx = finalTsx.replace(/https:\/\/lh3\.googleusercontent\.com\/aida\/AEtjO1UoHsnPjWRYBzYOyV8LpwHfURXrRr4DYLI1K6bxDZ6tiiPlhX4mnM5sRZEtlrsipk5wFi_i3O3NjMM329p9Qd-9rtZv1F1Ly-5nK8xvrRhHnpygfFwioH89BoVzw-TiFRyWEm_CTcL2E2hQGFqEi6chn-b2Jg6tZFD9Mrxn5rniyr2bMS1krusdffjJW4TvJmsGrTbFrIkxemZUBQ5EH-JhonRI6tAkgb1p0m6tA_D6uemFrYvV32znE5Bu/g, '/images/cozy_aesthetic_cafe_corner_at_the_cafe_barrackpore_neon_sign_glow_vintage.png');
finalTsx = finalTsx.replace(/https:\/\/lh3\.googleusercontent\.com\/aida-public\/AB6AXuDBtStj29U1h9KJJ-AIq-jf1lTzc7Unbo_VQEVunyZORqA27uNsu1cLJi705Oh4FvUWF6U898XTzLD53JMojnIhYym_SHV3hQgBFs2Btt5gSvSfakhYGeBFy1Kmx9wu1epy4KNPmQaDwRwUHZLIMtGijywo2fFAicOqm4_KiMAV4zNzmUz0IgYhDDBWfu9-z203TEy78uix7kdwM9LvaHfKaBqY-2O3qLQNlRUnAXPPsx-HH-mVTJ35EQ/g, '/images/artisan_mocktail_and_coffee_brewing_bar_at_the_cafe_barrackpore_glowing_neon.png');
finalTsx = finalTsx.replace(/https:\/\/lh3\.googleusercontent\.com\/aida-public\/AB6AXuA6lIJOvdzwHcKYAT8LIaK1unW4B76qHrGISTDn4QmU7MUGlO3v87IXEGWFar1BD4WnbBq9DjpNnPLKYwfZ_S0C9bNBZ8KBQ6c3_V0EY8khhcdD_j_9S84il-p-efaqAg9kQSQyPLZjGMrb0eY85oBe5le5Ps2QYb-QXkXQAXHDOT6BHRodHMo0bDmMQ3wolDvMnRJR8ieRhsekZcpreM3_lKmeYEMQOO5ygsBXk2acoF3ew-Z5tCCAng/g, '/images/high_end_cocktail_and_beverage_photography_of_a_glowing_vibrant_blue_curacao.png');
finalTsx = finalTsx.replace(/https:\/\/lh3\.googleusercontent\.com\/aida\/AEtjO1XbnberDH_5Mfp7J9WiJv0laVp9uJVYSvnQ03tfjH_1JUdRMf43a6eoixNFCAJywckvtreR6PvCb7A82-7ZTxuAiEwiUwn0i8WveDq4KwYVqVSuJtft-6NrHHgnpJDYUBQMs9pVY9pAsNv0XZO7jtlz-U1Lwz8RIuhZ4skl4ffuMam4j8P8RtpeW8LoeIoqd4u5ZKBrwhOzVtylnvw9cVN9j2m604-s2vwK9-UV2A13Tv0JBPO5lV493T_N/g, '/images/high_end_culinary_photography_of_a_thin_crust_artisanal_chicken_cheese_pizza.png');
finalTsx = finalTsx.replace(/https:\/\/lh3\.googleusercontent\.com\/aida-public\/AB6AXuDgChETPgDQlkXTYSHuvIhM2BJXxWN-3MWvW7rhNQ0p3QKVDNXgcBjq3sjYznE5yjnvZ_UHGsh7HrbagS_jacch8jg_wIhKeixv0fs0qBjaq0eSxuzPGe3NefwG37k3zuo2UBcnhqI7ZD1D43VyTbBItKNcfyzzIP58X2yMUK5iLQiSwuYHzGOQxnaI5He9Ql655QIAy_Kwo9vKoPI1kurtNT8fUxYjjtr0Ng2-wF7oe1q520Nx9Al0bA/g, '/images/gourmet_cafe_food_photography_flat_lay_gourmet_juicy_chicken_burger_with_melted.png');
finalTsx = finalTsx.replace(/https:\/\/lh3\.googleusercontent\.com\/aida-public\/AB6AXuBLOAw2Auk6qI-1rfomWyNMGYFujjyNpQqJAr8cD2adSPFPdMoimrtTQCd5IXaspp7KNVxKUaFzSNmCTdUEVIWbyFfekrOc0BLWBQGW5ymPKY2yL3GTAMKWY9JMxootlCxdZeH10jHgVB7hdQg19jNS2QUxq3Yro1_mwFFpw0N9Wvu4hbsDl_K6O_zdwuRxMcJ42hN4DWfpiSZXiykJE5lodnqXH76c8GuKnqxiPEJeD976TMcHcTlZ4g/g, '/images/high_end_restaurant_culinary_photography_of_chicken_pahadi_momos_steamed.png');
finalTsx = finalTsx.replace(/https:\/\/lh3\.googleusercontent\.com\/aida-public\/AB6AXuBkjamOdF8Jd7JflGD2k-LVlLv8tN447gco3UWhi87swZ_hmUmFJw07ML6uMhjZ7_y6cAJ4bIu9ki7ZM8luaC46jzD0YKc79dxvc-fn2Mk9dYYqz2-u_smyYMFWJ8slvkMP_OSMXVJb05QUra_xdllIAKOxo3crsr9BZw-QdHeG5kJT5rcHsdnHcLMeiojPxaE1nuJ7VaDa7lW5lq_0tH91hOaYQsskVxMDSFaPeJFbf_xxkBDx-05DBg/g, '/images/high_end_cocktail_and_beverage_photography_of_a_glowing_vibrant_blue_curacao.png');
finalTsx = finalTsx.replace(/https:\/\/lh3\.googleusercontent\.com\/aida-public\/AB6AXuD_b6MA-Uu_vCE4xxscaRzQ-TGFi8oY1QvPaa-yn23JOlkyMVec18xmucoiLRHrrPFAEtzl2VxJJ36bTYABKg794nUicCTiFpQIdlI5JQ3qKozJhhjvIVYecIsFNVBCKIR7KD1unurLESMs0GKIDH8v8YBwxjekSOzujce3q-pBLOAmEQtcj1pkrF6vTCNetcN9w7sMTracOLcjvmLkOHTlB4fmjx_XWxF999kD3FKdvgRww-OT5iCP3g/g, '/images/cinematic_luxury_interior_photo_of_a_trendy_modern_cafe_lounge_named_the_cafe.png');

fs.writeFileSync('src/App.tsx', finalTsx, 'utf8');
console.log('App.tsx successfully updated with true JSX!');
