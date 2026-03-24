import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const stats = [
  { value: 10000, suffix: "+", label: "Students Placed", prefix: "" },
  { value: 500, suffix: "+", label: "Partner Companies", prefix: "" },
  { value: 95, suffix: "%", label: "Placement Rate", prefix: "" },
  { value: 150, suffix: "+", label: "Campus Partners", prefix: "" },
  { value: 50, suffix: "+", label: "AI Mock Tests", prefix: "" },
  { value: 9.5, suffix: "/10", label: "Security Score", prefix: "" },
];

const AnimatedCounter = ({ target, suffix, prefix, inView }: { target: number; suffix: string; prefix: string; inView: boolean }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const isDecimal = target % 1 !== 0;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else { setCount(isDecimal ? parseFloat(current.toFixed(1)) : Math.floor(current)); }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
};

const StatsSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section className="py-12 relative overflow-hidden">
      <div className="absolute inset-0 gradient-bg opacity-[0.03]" />
      <div className="container mx-auto px-4 lg:px-8" ref={ref}>
        <div className="glass-card rounded-3xl p-6 lg:p-8">
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: index * 0.08, duration: 0.4, type: "spring" }}
                className="text-center"
              >
                <p className="font-display text-2xl lg:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix} inView={isInView} />
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
