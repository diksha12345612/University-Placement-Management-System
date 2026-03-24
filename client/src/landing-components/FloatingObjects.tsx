import { motion } from "framer-motion";
import {
  GraduationCap, Briefcase, FileText, Code2, Trophy,
  BookOpen, Brain, Target, Rocket, Star, Zap, Award
} from "lucide-react";

const floatingItems = [
  { Icon: GraduationCap, x: "5%", y: "8%", size: 28, delay: 0, duration: 14, color: "text-primary/20" },
  { Icon: Briefcase, x: "92%", y: "12%", size: 24, delay: 1.5, duration: 16, color: "text-accent/20" },
  { Icon: FileText, x: "88%", y: "35%", size: 22, delay: 3, duration: 13, color: "text-amber/15" },
  { Icon: Code2, x: "3%", y: "28%", size: 26, delay: 0.5, duration: 15, color: "text-primary/15" },
  { Icon: Trophy, x: "95%", y: "55%", size: 20, delay: 2, duration: 17, color: "text-amber/20" },
  { Icon: BookOpen, x: "7%", y: "50%", size: 24, delay: 4, duration: 14, color: "text-accent/15" },
  { Icon: Brain, x: "90%", y: "72%", size: 22, delay: 1, duration: 16, color: "text-primary/20" },
  { Icon: Target, x: "4%", y: "70%", size: 20, delay: 3.5, duration: 13, color: "text-accent/20" },
  { Icon: Rocket, x: "93%", y: "88%", size: 26, delay: 2.5, duration: 15, color: "text-amber/15" },
  { Icon: Star, x: "8%", y: "90%", size: 18, delay: 0, duration: 18, color: "text-primary/15" },
  { Icon: Zap, x: "50%", y: "5%", size: 20, delay: 1.5, duration: 14, color: "text-amber/10" },
  { Icon: Award, x: "48%", y: "95%", size: 22, delay: 3, duration: 16, color: "text-accent/10" },
  { Icon: GraduationCap, x: "15%", y: "40%", size: 18, delay: 2, duration: 12, color: "text-primary/10" },
  { Icon: Briefcase, x: "80%", y: "48%", size: 16, delay: 4.5, duration: 14, color: "text-accent/10" },
  { Icon: Code2, x: "70%", y: "15%", size: 20, delay: 1, duration: 15, color: "text-primary/10" },
  { Icon: Trophy, x: "25%", y: "75%", size: 16, delay: 3, duration: 13, color: "text-amber/10" },
];

const FloatingObjects = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      {floatingItems.map((item, i) => (
        <motion.div
          key={i}
          className={`absolute ${item.color}`}
          style={{ left: item.x, top: item.y }}
          animate={{
            y: [0, -30, 15, -20, 0],
            x: [0, 15, -10, 20, 0],
            rotate: [0, 10, -5, 15, 0],
            scale: [1, 1.1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: item.duration,
            delay: item.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <item.Icon size={item.size} strokeWidth={1.5} />
        </motion.div>
      ))}
    </div>
  );
};

export default FloatingObjects;
