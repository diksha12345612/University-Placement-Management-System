import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const partners = [
  "Google", "Microsoft", "Amazon", "Goldman Sachs", "Deloitte",
  "Infosys", "TCS", "Wipro", "Adobe", "Oracle",
  "Accenture", "McKinsey", "JP Morgan", "Meta", "Apple"
];

const PartnersSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section className="py-8 overflow-hidden border-y border-border/30">
      <div className="container mx-auto px-4 lg:px-8" ref={ref}>
        <motion.p initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} className="text-center text-xs text-muted-foreground font-medium mb-5 uppercase tracking-wider">
          Trusted by leading recruiters worldwide
        </motion.p>
        <div className="relative overflow-hidden">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />
          <div className="flex gap-6 animate-marquee">
            {[...partners, ...partners, ...partners].map((partner, i) => (
              <div key={`${partner}-${i}`} className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-secondary/50 border border-border/30">
                <span className="font-display font-semibold text-muted-foreground/60 text-sm whitespace-nowrap">{partner}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PartnersSection;
