export const HERO_CHANGELOG = `
# Hero Section Premium Upgrade

1. **Applied "Editorial Split" Layout**
   - Converted the boxy 60/40 layout to a dramatic, asymmetric split.
   - Introduced massive, tightly tracked typography (scaled using \`text-[12vw]\`) with an elegant serif-italic emphasis on "Gastronomy" to match the vintage/premium brand identity.

2. **Implemented "Double-Bezel" (Doppelrand) Architecture**
   - Replaced the blurry \`radial-gradient\` mask with a high-end nested hardware shell. 
   - The hero image is now wrapped in an outer glass container (\`backdrop-blur-2xl\`, \`bg-white/5\`) with an inner, perfectly matched radius core to give it physical depth.

3. **Motion & "Button-in-Button" Physics**
   - Removed generic pill buttons.
   - The primary CTA now uses the "Island" pattern where the trailing arrow is nested inside its own circular wrapper with magnetic hover physics (\`group-hover:translate-x-1 group-hover:scale-105\`).
   - All animations now use custom cubic-bezier curves (\`ease-[cubic-bezier(0.32,0.72,0,1)]\`) for fluid, hardware-accelerated motion instead of default \`ease-out\`.

4. **Color Calibration & Texture**
   - Shifted the background from a flat brown to a deep espresso/off-black (\`#0a0807\`).
   - Injected an ambient "Ethereal Glass" mesh glow in the background.
   - Added a subtle CSS noise overlay (\`mix-blend-overlay\`) to make the page feel like a physical, tactile surface rather than just pixels.

5. **Fixed Backend Migration Integration**
   - Removed legacy \`sanityClient\` imports and correctly wired the component to the new Supabase \`SiteConfigContext\` (\`hero.src\`, \`hero.alt\`, \`hero.headline\`) to ensure the production build passes perfectly.
`;
