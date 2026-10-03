import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { clientDetails } from '../config/client';
import { validateAndNormalizeTableNumber } from '../utils/tableValidation';
import { useSiteConfig } from '../context/SiteConfigContext';
import { buildTableQrUrl } from '../utils/url';

export const QRCodeGenerator: React.FC = () => {
  const { restaurantConfig, logoUrl } = useSiteConfig();
  const [tableInput, setTableInput] = useState<string>('07');
  const [copied, setCopied] = useState<boolean>(false);

  const businessName = restaurantConfig?.businessName || clientDetails.businessName;

  // Normalize table number safely
  const validation = validateAndNormalizeTableNumber(tableInput);
  const normalizedTable = validation.isValid && validation.normalized ? validation.normalized : '07';

  // Authoritative production QR URL
  const qrUrl = buildTableQrUrl(normalizedTable);

  const handleTableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTableInput(e.target.value);
  };

  const handleQuickSelect = (tableNum: number) => {
    setTableInput(String(tableNum).padStart(2, '0'));
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4 sm:p-8 text-stone-900 font-sans print:p-0 print:bg-white print:m-0">
      {/* Controls Header - Hidden when printing */}
      <div className="max-w-md w-full mb-6 print:hidden">
        <div className="flex items-center justify-between mb-4">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-950 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Website
          </a>
          <span className="text-xs font-medium px-2.5 py-1 bg-stone-200 text-stone-700 rounded-full">
            Staff QR Tool
          </span>
        </div>

        {/* Table Selector Box */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
          <label htmlFor="table-selector-input" className="block text-xs uppercase font-bold tracking-wider text-stone-500 mb-2">
            Select Table Number (1 - 99)
          </label>
          <div className="flex items-center gap-3">
            <input
              id="table-selector-input"
              type="number"
              min={1}
              max={99}
              value={tableInput}
              onChange={handleTableChange}
              className="w-24 text-center font-bold text-2xl py-2 px-3 border-2 border-stone-300 rounded-xl focus:border-amber-600 focus:outline-none"
            />
            <div className="flex-1 flex flex-wrap gap-1.5">
              {[1, 2, 3, 5, 7, 10, 12, 15].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleQuickSelect(num)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors ${
                    normalizedTable === String(num).padStart(2, '0')
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  T{String(num).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
          {!validation.isValid && (
            <p className="text-xs text-red-600 mt-2">
              {validation.error || 'Please enter a valid table number between 1 and 99.'}
            </p>
          )}

          {/* Quick URL preview & copy */}
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <span className="truncate max-w-[240px] font-mono text-[11px]">{qrUrl}</span>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* Printable Branded Card */}
      <div className="max-w-sm w-full bg-white border-2 border-stone-200 rounded-3xl p-8 shadow-xl flex flex-col items-center text-center print:border-none print:shadow-none print:p-4 print:max-w-none print:w-full">
        {/* Branding */}
        <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mb-4 p-3 shadow-md">
          <img src={logoUrl || "/logo.webp"} alt="Logo" className="w-full h-full object-contain filter invert" />
        </div>

        <h1 className="text-xl font-bold font-serif uppercase tracking-[0.18em] text-stone-900 mb-1">
          {businessName}
        </h1>
        <p className="text-stone-500 uppercase tracking-widest text-[11px] font-semibold mb-6">
          Order from your table
        </p>

        {/* Table Number Highlight */}
        <div className="mb-6 px-6 py-2 rounded-full bg-amber-50 border border-amber-300">
          <span className="text-2xl font-black font-serif tracking-wider text-amber-900 uppercase">
            TABLE {normalizedTable}
          </span>
        </div>

        {/* QR Code (Pure High Contrast, No Overlays for 100% Optical Reliability) */}
        <div className="bg-white p-3 rounded-2xl shadow-inner border border-stone-200 mb-6">
          <QRCodeSVG
            value={qrUrl}
            size={220}
            level="H"
            includeMargin={true}
            fgColor="#000000"
            bgColor="#ffffff"
          />
        </div>

        <p className="text-stone-800 font-semibold text-sm mb-1">Scan to Order</p>
        <p className="text-stone-500 text-xs mb-4">Point your camera to view menu & place your order</p>

        <div className="pt-4 border-t border-stone-100 w-full text-[10px] text-stone-400 uppercase tracking-wider">
          The Café Barrackpore • Smart Dine-In
        </div>
      </div>

      {/* Action Buttons - Hidden when printing */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md w-full print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 px-6 py-3 bg-stone-900 text-white rounded-full font-semibold hover:bg-stone-800 transition-colors shadow-md flex items-center justify-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-base">print</span>
          Print Table Card
        </button>

        <a
          href={qrUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full font-semibold transition-colors shadow-md text-sm"
        >
          <span className="material-symbols-outlined text-base">open_in_new</span>
          Test Table {normalizedTable}
        </a>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
