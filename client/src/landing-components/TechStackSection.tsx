import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Shield, Cpu, Database, Globe, Lock, Layers } from "lucide-react";

const techItems = [
  { icon: Globe, label: "React + Vite", desc: "Lightning-fast frontend" },
  { icon: Database, label: "MongoDB", desc: "Scalable NoSQL database" },
  { icon: Cpu, label: "Node.js", desc: "Robust backend server" },
  { icon: Lock, label: "JWT + bcrypt", desc: "Enterprise-grade auth" },
  { icon: Shield, label: "Security A+", desc: "9.5/10 security score" },
  { icon: Layers, label: "REST API", desc: "Clean API architecture" },
];

const TechStackSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="py-10 relative overflow-hidden border-y border-border/30">
      <div className="container mx-auto px-4 lg:px-8" ref={ref}>
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          className="text-center text-xs text-muted-foreground font-medium mb-6 uppercase tracking-wider"
        >
          Built with production-grade technology
        </motion.p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {techItems.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -4 }}
              className="glass-card rounded-xl p-3 text-center group cursor-default"
            >
              <item.icon className="w-5 h-5 text-primary mx-auto mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="font-display text-xs font-semibold text-foreground">{item.label}</p>
              <p className="text-[10px] text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TechStackSection;
