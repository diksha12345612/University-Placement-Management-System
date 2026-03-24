import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import {
  GraduationCap, Building2, ShieldCheck,
  BarChart3, FileText, Search, Bell, Users, CheckCircle2,
  Briefcase, ClipboardList, TrendingUp, Megaphone, UserCheck, Settings
} from "lucide-react";

const roles = [
  {
    id: "student",
    label: "Students",
    icon: GraduationCap,
    color: "from-blue-600 to-cyan-600",
    features: [
      { icon: BarChart3, title: "Personalized Dashboard", desc: "Track applications, upcoming drives & placement status in real-time" },
      { icon: Search, title: "Smart Job Finder", desc: "Advanced filtering with eligibility checks for matching roles" },
      { icon: FileText, title: "Resume Upload + ATS", desc: "AI-powered scoring with criteria-wise breakdown" },
      { icon: Bell, title: "Real-time Notifications", desc: "Instant alerts for new postings, schedules & results" },
    ],
  },
  {
    id: "recruiter",
    label: "Recruiters",
    icon: Building2,
    color: "from-accent to-amber",
    features: [
      { icon: Briefcase, title: "Job Lifecycle Management", desc: "Post roles, define eligibility & track applications end-to-end" },
      { icon: ClipboardList, title: "Applicant Tracking", desc: "Shortlist, interview & manage candidates through the pipeline" },
      { icon: Users, title: "Candidate Analysis", desc: "AI-powered candidate fit analysis for better hiring decisions" },
      { icon: TrendingUp, title: "Hiring Analytics", desc: "Track conversion rates, time-to-hire & recruitment metrics" },
    ],
  },
  {
    id: "tpo",
    label: "Admin / TPO",
    icon: ShieldCheck,
    color: "from-amber-500 to-blue-600",
    features: [
      { icon: UserCheck, title: "Verification Workflows", desc: "Approve students & verify recruiter credentials" },
      { icon: Megaphone, title: "Broadcaster", desc: "Send announcements to all students and recruiters" },
      { icon: BarChart3, title: "Advanced Analytics", desc: "Comprehensive dashboard with placement insights & trends" },
      { icon: Settings, title: "Full Platform Control", desc: "Manage users, drives, policies & system configuration" },
    ],
  },
];

const RoleFeaturesSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [activeRole, setActiveRole] = useState("student");
  const active = roles.find((r) => r.id === activeRole)!;

  return (
    <section className="py-14 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-secondary/20 via-transparent to-secondary/20" />

      <div className="container mx-auto px-4 lg:px-8" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center max-w-2xl mx-auto mb-8"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600/10 text-blue-600 text-xs font-semibold mb-3">
            <Users className="w-3.5 h-3.5" />
            Built for Every Stakeholder
          </span>
          <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
            Tailored for <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">every role</span>
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Whether you're a student, recruiter, or placement officer — the platform adapts to your needs.
          </p>
        </motion.div>

        {/* Role tabs */}
        <div className="flex justify-center gap-2 mb-8">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeRole === role.id
                  ? "gradient-bg text-primary-foreground shadow-lg"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <role.icon className="w-4 h-4" />
              {role.label}
            </button>
          ))}
        </div>

        {/* Feature cards */}
        <motion.div
          key={activeRole}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto"
        >
          {active.features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
              whileHover={{ scale: 1.02 }}
              className="glass-card glass-card-hover rounded-2xl p-5 flex gap-4 items-start"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${active.color} flex items-center justify-center flex-shrink-0`}>
                <feature.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm text-foreground mb-1">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{feature.desc}</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default RoleFeaturesSection;
