import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { siteConfig as fallbackConfig } from '../data/siteConfig';
import { client } from '../lib/sanityClient';
import imageUrlBuilder from '@sanity/image-url';

const builder = imageUrlBuilder(client);
function urlFor(source: any) {
  return builder.image(source);
}

const AnimatedText = ({ text }: { text: string }) => {
  const container = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start 85%", "center 50%"]
  });

  const words = text.split(" ");
  
  return (
    <p ref={container} className="font-body-md text-base md:text-lg leading-relaxed flex flex-wrap gap-x-[0.25em] gap-y-1 mb-6">
      {words.map((word, i) => {
        const start = i / words.length;
        const end = start + (1 / words.length);
        const opacity = useTransform(scrollYProgress, [start, end], [0.2, 1]);
        const lowerWord = word.toLowerCase();
        const isHighlight = lowerWord.includes("luxury") || lowerWord.includes("acoustic") || lowerWord.includes("signature") || lowerWord.includes("pours");
        const color = isHighlight ? "#D4AF37" : "#E3DACD";
        
        return (
          <motion.span key={i} style={{ opacity, color }} className="transition-colors duration-300">
            {word}
          </motion.span>
        );
      })}
    </p>
  );
};

export const OurStory: React.FC = () => {
  const [image, setImage] = useState({ src: fallbackConfig.ourStory.image, alt: fallbackConfig.ourStory.alt });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await client.fetch(`*[_type == "siteConfig"][0]{ ourStoryImage }`);
        if (config?.ourStoryImage) {
          setImage({
            src: urlFor(config.ourStoryImage).width(1200).auto('format').quality(80).url(),
            alt: 'Our Story'
          });
        }
      } catch (error) {
        console.error("Error fetching Sanity config:", error);
      }
    };
    fetchConfig();
  }, []);

  return (
    <section className="w-full py-16 lg:py-32 bg-background relative" id="our-story">
      <div className="max-w-[1320px] mx-auto px-4 md:px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
          {/* Left Side: Image */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="relative w-full h-96 sm:h-[500px] md:h-[700px] rounded-2xl overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/5" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-80 z-10 pointer-events-none" />
            {/* Real Image */}
            <img loading="lazy"
              src={image.src} 
              alt={image.alt} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          </motion.div>

          {/* Right Side: Content */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col gap-6"
          >
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-xl font-light">star</span>
              <span className="font-label-sm text-xs uppercase tracking-[0.2em] text-primary font-semibold">Our Philosophy</span>
            </div>
            
            <h2 className="font-headline-lg text-4xl md:text-5xl lg:text-6xl text-on-surface font-serif tracking-tight leading-tight">
              Crafting Barrackpore’s finest <br className="hidden lg:block"/><span className="italic font-light">nocturnal escape</span>
            </h2>
            
            <div className="w-20 h-[1px] bg-primary/30 my-2" />
            
            <AnimatedText text="We believe that true luxury lies in the details. From sourcing the most vibrant, local ingredients from surrounding farms to hand-selecting the perfect acoustic backdrop, every element of our space is intentionally curated." />
            
            <AnimatedText text="This isn't just a cafe; it's a sanctuary designed for those who appreciate the art of slowing down. A place where deep conversations flow as freely as our signature pours." />
            
            <div className="mt-8 flex flex-col items-start border-t border-primary/20 pt-6">
              <span className="font-serif text-3xl md:text-4xl italic text-primary font-medium" style={{ fontFamily: 'var(--font-serif)' }}>
                Arindam & Suman
              </span>
              <span className="font-label-sm uppercase tracking-[0.2em] text-[#E3DACD]/60 mt-2 text-[10px] sm:text-xs">
                Founders, The Cafe Barrackpore
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
