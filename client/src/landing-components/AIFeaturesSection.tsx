import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Brain, Code2, MessageSquare, Route, FileSearch, Lightbulb } from "lucide-react";

const aiFeatures = [
  {
    icon: Route,
    title: "DSA Roadmap",
    description: "Curated 8-week structured roadmap for coding excellence with topic-wise challenges.",
    gradient: "from-primary to-accent",
  },
  {
    icon: Brain,
    title: "AI Mock Tests",
    description: "Timed assessments with instant AI-powered feedback and performance analytics.",
    gradient: "from-accent to-primary",
  },
  {
    icon: MessageSquare,
    title: "AI Interview Prep",
    description: "Role-based interview questions with detailed evaluation, model answers & improvement tips.",
    gradient: "from-primary to-amber",
  },
  {
    icon: FileSearch,
    title: "Resume ATS Analysis",
    description: "AI-powered scoring with criteria-wise breakdown and targeted resume improvements.",
    gradient: "from-amber to-accent",
  },
  {
    icon: Code2,
    title: "Practice Portals",
    description: "Topic-wise coding challenges and theoretical concepts for thorough preparation.",
    gradient: "from-accent to-amber",
  },
  {
    icon: Lightbulb,
    title: "AI Career Mentor",
    description: "Role-focused multi-phase preparation plans tailored to your career goals.",
    gradient: "from-amber to-primary",
  },
];

const AIFeaturesSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-14 relative overflow-hidden">
      {/* Dense background pattern */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-accent/[0.03]" />
        <div className="blob w-[500px] h-[500px] bg-primary absolute -top-40 right-1/4 opacity-[0.04] animate-float" />
        <div className="blob w-[400px] h-[400px] bg-accent absolute bottom-0 left-0 opacity-[0.03] animate-float-delayed" />
      </div>

      <div className="container mx-auto px-4 lg:px-8" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-10"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-3">
            <Brain className="w-3.5 h-3.5" />
            AI-Powered Preparation Hub
          </span>
          <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
            Supercharge your prep with
            <span className="gradient-text"> Artificial Intelligence</span>
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            From structured learning paths to AI-driven mock interviews — everything you need to ace campus placements.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aiFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: index * 0.07, duration: 0.45 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="glass-card glass-card-hover rounded-2xl p-5 group cursor-default relative overflow-hidden"
            >
              {/* Gradient line at top */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="font-display font-semibold text-base text-foreground mb-1.5">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AIFeaturesSection;
