import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const CTASection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-14 relative overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8" ref={ref}>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={isInView ? { opacity: 1, scale: 1 } : {}} className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 shadow-2xl">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          <div className="blob w-[400px] h-[400px] bg-cyan-400 absolute -top-40 -right-20 opacity-20 animate-float" />
          <div className="blob w-[300px] h-[300px] bg-purple-400 absolute -bottom-20 -left-20 opacity-20 animate-float-delayed" />

          <div className="relative z-10 text-center py-16 lg:py-20 px-6">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.2 }} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-none bg-white/10 border border-white/20 text-white text-xs font-semibold mb-6 shadow-sm backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              Start Your Journey Today
            </motion.div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-white max-w-3xl mx-auto leading-tight tracking-tight">
              Ready to transform campus placements?
            </h2>
            <p className="text-white/80 mt-5 text-lg max-w-xl mx-auto font-medium">
              Join the platform trusted by universities, recruiters & students for AI-powered placement management.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-10">
              <Link to="/register" className="bg-white text-blue-700 rounded-xl h-14 px-8 text-base font-bold hover:bg-neutral-50 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all duration-300 inline-flex items-center gap-2 shadow-xl ring-4 ring-white/20">
                Get Started Free <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
