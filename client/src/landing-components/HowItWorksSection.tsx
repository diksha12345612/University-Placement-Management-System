import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { UserPlus, Search, Send, Trophy } from "lucide-react";

const steps = [
  { icon: UserPlus, step: "01", title: "Create Profile", description: "Sign up as Student, Recruiter or Admin and build your profile." },
  { icon: Search, step: "02", title: "Discover & Prepare", description: "Browse jobs, take AI mock tests & use the DSA roadmap." },
  { icon: Send, step: "03", title: "Apply & Track", description: "Submit applications and track progress through every stage." },
  { icon: Trophy, step: "04", title: "Get Placed", description: "Receive offers and celebrate your placement success." },
];

const HowItWorksSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" className="py-14 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-secondary/30 to-background" />
      <div className="container mx-auto px-4 lg:px-8" ref={ref}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={isInView ? { opacity: 1, y: 0 } : {}} className="text-center max-w-2xl mx-auto mb-10">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-3">How It Works</span>
          <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
            Four steps to your <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">dream career</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 relative">
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-blue-600/20" />
          {steps.map((step, index) => (
            <motion.div key={step.step} initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: index * 0.12 }} className="text-center relative">
              <div className="relative inline-flex mb-4">
                <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center glow-ring">
                  <step.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber text-amber-foreground text-[10px] font-bold flex items-center justify-center">{step.step}</span>
              </div>
              <h3 className="font-display font-semibold text-base text-foreground mb-1">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-[200px] mx-auto">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
