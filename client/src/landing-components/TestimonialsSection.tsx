import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Star, Quote } from "lucide-react";

const testimonials = [
  { name: "Priya Sharma", role: "Placed at Google", avatar: "PS", rating: 5, text: "The AI mock tests and interview prep gave me the confidence I needed. Landed my dream role!" },
  { name: "Arjun Patel", role: "Placed at Microsoft", avatar: "AP", rating: 5, text: "Resume ATS analysis was a game-changer. Got shortlisted at 4 companies in my first week." },
  { name: "Sneha Reddy", role: "Placement Officer", avatar: "SR", rating: 5, text: "As TPO, the broadcaster and analytics dashboard saved me hundreds of hours managing drives." },
  { name: "Rahul Verma", role: "Placed at Goldman Sachs", avatar: "RV", rating: 5, text: "The DSA roadmap and practice portals structured my preparation perfectly for coding rounds." },
  { name: "Ananya Gupta", role: "Campus Recruiter", avatar: "AG", rating: 5, text: "Applicant tracking and candidate analysis make hiring from campuses incredibly efficient." },
  { name: "Vikram Singh", role: "Placed at Deloitte", avatar: "VS", rating: 5, text: "AI Career Mentor gave me a phase-wise plan. Every step was smooth from profile to offer." },
];

const TestimonialsSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="testimonials" className="py-14 relative overflow-hidden">
      <div className="blob w-[500px] h-[500px] bg-accent absolute -top-40 -right-40 opacity-[0.03] animate-float" />
      <div className="blob w-[400px] h-[400px] bg-primary absolute bottom-0 left-0 opacity-[0.04] animate-float-delayed" />
      <div className="container mx-auto px-4 lg:px-8" ref={ref}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={isInView ? { opacity: 1, y: 0 } : {}} className="text-center max-w-2xl mx-auto mb-10">
          <span className="inline-block px-4 py-1.5 rounded-full bg-amber/10 text-amber text-xs font-semibold mb-3">Testimonials</span>
          <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
            Loved by students <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">across campuses</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((t, index) => (
            <motion.div key={t.name} initial={{ opacity: 0, y: 24 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: index * 0.08 }} whileHover={{ y: -4 }} className="glass-card glass-card-hover rounded-2xl p-5">
              <Quote className="w-6 h-6 text-blue-600/20 mb-2" />
              <p className="text-foreground/80 text-sm leading-relaxed mb-3">{t.text}</p>
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber text-amber" />)}
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-primary-foreground text-[10px] font-bold">{t.avatar}</div>
                <div>
                  <p className="font-display font-semibold text-sm text-foreground">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
