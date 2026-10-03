import React, { useEffect } from 'react';
import { useSiteConfig } from '../../context/SiteConfigContext';

export const PrivacyPolicyPage: React.FC = () => {
  const { logoUrl } = useSiteConfig();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Privacy Policy | The Café Barrackpore';
  }, []);

  return (
    <div className="min-h-screen bg-[#0E0906] text-on-surface font-sans selection:bg-[#D4AF37]/30 selection:text-[#D4AF37]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#140D09]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full border border-[#D4AF37]/40 bg-[#1C120D] flex items-center justify-center overflow-hidden shadow-sm group-hover:border-[#D4AF37] transition-colors">
              <img src={logoUrl || "/logo.webp"} alt="The Café Crest" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-base text-white font-semibold tracking-tight">The Café</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#D4AF37]">Barrackpore</span>
            </div>
          </a>

          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 hover:text-white border border-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Dining</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
        <div className="mb-12 border-b border-white/10 pb-8">
          <span className="font-mono text-xs uppercase tracking-widest text-[#D4AF37] mb-2 block">
            Legal &amp; Data Governance
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-normal tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-zinc-400 text-sm font-light">
            Effective Date: October 2, 2026 · Last Updated: October 2026
          </p>
        </div>

        <div className="space-y-10 text-zinc-300 text-sm leading-relaxed font-light">
          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">1. Introduction</h2>
            <p>
              The Café Barrackpore (“we”, “our”, or “us”) respects your privacy and is committed to protecting the personal data you share with us. This Privacy Policy explains how we collect, store, utilize, and protect your information when you visit our website, use our Smart QR table-ordering service, reserve a dining table, or engage with our guest concierge.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">2. Information We Collect</h2>
            <p>We only collect data that is strictly necessary to deliver culinary excellence and hospitality services:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li><strong className="text-white">Guest Identity &amp; Contact:</strong> Full name, phone number, and optional special dietary notes when you book a table or place an order.</li>
              <li><strong className="text-white">Dine-in Table Context:</strong> Table number identifiers decoded from authentic in-house QR codes to route orders to your physical seat.</li>
              <li><strong className="text-white">Order &amp; Transaction Details:</strong> Item selections, quantities, timestamps, transaction totals, and payment status.</li>
              <li><strong className="text-white">Technical &amp; Device Information:</strong> Browser type, approximate location (city level), and Cloudflare Turnstile verification tokens to prevent automated fraud and bot abuse.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">3. How We Use Your Information</h2>
            <p>Your information is used solely for operational hospitality purposes:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>Dispatching tickets to our kitchen display system for timely preparation.</li>
              <li>Confirming table reservations and managing dining floor capacity.</li>
              <li>Sending automated WhatsApp/SMS order status receipts and concierge updates upon request.</li>
              <li>Preventing malicious bot submissions and unauthorized ordering via rate limiting.</li>
            </ul>
            <p className="text-zinc-400 font-medium">
              We NEVER sell, rent, or trade your personal information to third-party advertisers or data brokers under any circumstances.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">4. Payment Security &amp; Financial Data</h2>
            <p>
              All online payments are processed through PCI-DSS Level 1 certified gateways (Stripe and Razorpay). The Café Barrackpore does not store, process, or have access to your raw credit card numbers, CVVs, or bank credentials. Payment authorization occurs over encrypted TLS connections directly with the certified provider.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">5. Cookies &amp; Local Storage</h2>
            <p>
              We use minimal, privacy-centric cookies and browser local storage strictly for functional purposes:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li><strong className="text-white">Essential Session Storage:</strong> Retaining your cart items during dining, remembering your table QR code, and preserving staff authentication tokens.</li>
              <li><strong className="text-white">User Preferences:</strong> Storing your preferred language (i18n), dietary filter preference (e.g., Pure Veg Only), and cookie consent status.</li>
              <li><strong className="text-white">Rate Limiting Tokens:</strong> Protecting reservation and ordering endpoints from repetitive denial-of-service spam.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">6. Data Retention &amp; Your Rights</h2>
            <p>
              Order and reservation records are retained in compliance with applicable commercial hospitality regulations in India. You possess the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>Request a copy of your personal data stored in our database.</li>
              <li>Request correction or deletion of your historical guest contact details.</li>
              <li>Opt out of any marketing or promotional concierge communications.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl text-white font-medium">7. Contact Our Privacy Concierge</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact our management team:
            </p>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1 font-mono text-xs">
              <p><span className="text-[#D4AF37]">Location:</span> 14/A Riverside Road, Cantonment, Barrackpore, Kolkata, WB 700120</p>
              <p><span className="text-[#D4AF37]">Email:</span> privacy@thecafebarrackpore.com</p>
              <p><span className="text-[#D4AF37]">Phone:</span> +91 98300 00000</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4 text-center text-xs text-zinc-500">
        <p>© {new Date().getFullYear()} The Café Barrackpore. All culinary and brand rights reserved.</p>
      </footer>
    </div>
  );
};

export default PrivacyPolicyPage;
