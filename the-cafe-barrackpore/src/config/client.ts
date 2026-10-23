const staffDomain = "thecafebarrackpore.com";

export const clientDetails = {
  businessName: "The Cafe",
  shortName: "Barrackpore",
  displayLocation: "Barrackpore",
  phone: "+918420507105",
  displayPhone: "084205 07105",
  whatsapp: "+918420507105",
  email: "contact@thecafe.com",
  address: "14, Riverside Road, Cantonment",
  googleMapsLink: "https://maps.app.goo.gl/6N1csn9kKtCY7By97",
  instagramLink: "https://www.instagram.com/the_cafe_barrackpore?stkn=dmxjN2xuZGhtbTMw",
  facebookLink: "#",
  zomatoLink: "#",
  tagline1: "Nocturnal Dining & Artisanal Roasts",
  tagline2: "Craving an Unmatched Culinary Evening?",
  description: "A refined nocturnal retreat blending candlelit comfort with modern gastronomy, artisanal roasts, and signature beverages.",
  elfsightId: "", // Built-in Google reviews card is used when empty
  googleReviewLink: "https://maps.app.goo.gl/6N1csn9kKtCY7By97",
  staffDomain: staffDomain,
  canonicalDomain: staffDomain,
  clientMode: (((globalThis as any).process?.env?.VITE_CLIENT_MODE) || (import.meta as any).env?.VITE_CLIENT_MODE || 'demo') as 'demo' | 'production',
  inquiryPrefix: "INQ-2026",
  conciergeWhatsAppGreeting: "Hello {businessName} Concierge! ☕",
  location: { address: "14, Riverside Road, Cantonment", city: "Barrackpore" },
};
