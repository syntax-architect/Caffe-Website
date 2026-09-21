const fs = require('fs');
let code = fs.readFileSync('src/components/AboutVibe.tsx', 'utf8');

const hook = "import React, { useState } from 'react';";
code = code.replace(/import React from 'react';/, hook);

const startHook = "export const AboutVibe: React.FC = () => {\n  const [isPlaying, setIsPlaying] = useState(false);\n";
code = code.replace(/export const AboutVibe: React.FC = \(\) => {/, startHook);

code = code.replace(/<button id="music-toggle-btn"  data-playing="false" className="(.*?)">([\s\S]*?)<\/button>/,
  `<button id="music-toggle-btn" onClick={() => setIsPlaying(!isPlaying)} data-playing={isPlaying} className="$1 ${'${'}isPlaying ? 'animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.5)]' : ''${'}'}">\n    <span className="material-symbols-outlined text-base">${'${'}isPlaying ? 'pause_circle' : 'play_circle'${'}'}</span>\n    <span className="label-text font-semibold">${'${'}isPlaying ? 'Pause Vibe' : 'Play Vibe'${'}'}</span>\n  </button>`
);

fs.writeFileSync('src/components/AboutVibe.tsx', code);
