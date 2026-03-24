import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Users, Briefcase, BarChart3, Shield, Clock, Globe,
  FileText, Zap, Target
} from "lucide-react";

const features = [
  { icon: Users, title: "Student Portal", description: "Comprehensive profiles to organize academic records, skills, and track placement progress.", color: "bg-primary/10 text-primary" },
  { icon: Briefcase, title: "Recruiter Portal", description: "Post job openings, manage candidates, and streamline the entire hiring workflow securely.", color: "bg-accent/10 text-accent" },
  { icon: BarChart3, title: "Admin Management", description: "Monitor placement drives, generate reports, and oversee student/recruiter activities.", color: "bg-amber/10 text-amber" },
  { icon: Zap, title: "AI Interview Evaluation", description: "Automated mock interviews with AI-driven feedback based on industry standards.", color: "bg-primary/10 text-primary" },
  { icon: FileText, title: "Resume Processing", description: "Upload and analyze resumes to ensure ATS compatibility for campus recruitment.", color: "bg-accent/10 text-accent" },
  { icon: Clock, title: "Real-time Updates", description: "Instant notifications for new job postings, interview schedules & selection results.", color: "bg-amber/10 text-amber" },
];

const FeaturesSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="features" className="py-14 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="blob w-[600px] h-[600px] bg-primary absolute top-0 left-1/4 opacity-[0.03] animate-float-delayed" />
        <div className="blob w-[400px] h-[400px] bg-accent absolute bottom-0 right-0 opacity-[0.04] animate-float" />
      </div>

      <div className="container mx-auto px-4 lg:px-8" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-10"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
            Features
          </span>
          <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
            Everything you need for
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600"> campus placements</span>
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            A comprehensive suite to streamline the entire placement process.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.06, duration: 0.4 }}
              whileHover={{ y: -4, scale: 1.01 }}
              className="glass-card glass-card-hover rounded-2xl p-5 transition-all duration-300 group cursor-default"
            >
              <div className={`w-10 h-10 rounded-xl ${feature.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="font-display font-semibold text-base text-foreground mb-1">
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

export default FeaturesSection;
