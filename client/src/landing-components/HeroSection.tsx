import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { ArrowRight, GraduationCap, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import dashboardMockup from "@/assets/dashboard-mockup.jpg";
import education3d from "@/assets/education-3d.png";
import heroBg from "@/assets/hero-bg.jpg";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";
import toast from "react-hot-toast";

const HeroSection = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "register">("signin");
  
  // Auth Form States
  const [name, setName] = useState("");
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const mockupY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Please fill all fields");
    setLoading(true);
    try {
      const data = await login(email, password);
      toast.success("Login successful!");
      navigate(data.user.role === "admin" ? "/admin/dashboard" : data.user.role === "recruiter" ? "/recruiter/dashboard" : "/student/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !role) return toast.error("Please fill all fields");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    try {
      const res = await authAPI.registerOtp({ name, email, password, role });
      if (res.data?.emailSent === true) {
        toast.success("OTP sent to your email!");
        setStep(2);
      } else {
        toast.error("Failed to send OTP.");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error("Please enter a valid 6-digit OTP");
    setLoading(true);
    try {
      const res = await authAPI.registerVerify({ name, email, password, role, otp });
      if (!res.data.token) {
        toast.success("Your recruiter account request is under review.");
        navigate("/login");
        return;
      }
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      toast.success("Account created!");
      window.location.href = res.data.user.role === "recruiter" ? "/recruiter/dashboard" : "/student/dashboard";
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Verification failed. Invalid OTP?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="home" ref={sectionRef} className="relative overflow-hidden">
      <motion.div style={{ y: bgY }} className="absolute inset-0 -z-10">
        <img src={heroBg} alt="" className="w-full h-[120%] object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
      </motion.div>

      {/* Floating blobs */}
      <div className="blob w-[700px] h-[700px] bg-primary absolute -top-80 -right-80 opacity-[0.06] animate-float" />
      <div className="blob w-[500px] h-[500px] bg-accent absolute top-1/2 -left-60 opacity-[0.05] animate-float-delayed" />
      <div className="blob w-[400px] h-[400px] bg-amber absolute bottom-20 right-1/4 opacity-[0.04] animate-float" />


      <div className="container mx-auto px-4 lg:px-8 pt-24 lg:pt-32 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left */}
          <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-none bg-white/10 text-white text-xs font-semibold mb-4 border border-white/20">
              <GraduationCap className="w-3.5 h-3.5" />
              University Placement & Preparation Portal
            </div>

            <h1 className="font-display text-4xl lg:text-[3.2rem] font-bold text-white leading-[1.08] tracking-tight">
              Your Gateway to
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-white">Campus Placements</span>
            </h1>

            <p className="text-white/80 text-base mt-3 leading-relaxed max-w-lg">
              A comprehensive, production-grade platform bridging students, recruiters & placement officers with streamlined recruitment workflows.
            </p>

            {/* Stats */}
            <div className="flex flex-wrap gap-5 mt-5">
              {[
                { value: "10k+", label: "Placements" },
                { value: "500+", label: "Companies" },
                { value: "95%", label: "Success Rate" },
                { value: "9.5/10", label: "Security" },
              ].map((stat, i) => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }}>
                  <p className="font-display text-lg font-bold text-white">{stat.value}</p>
                  <p className="text-[11px] text-white/70">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            <div className="flex gap-4 mt-8">
              <Link to="/register" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-6 text-sm font-semibold transition-colors inline-flex items-center gap-2 shadow-lg shadow-blue-600/20">
                Start Your Journey <ArrowRight className="w-4 h-4" />
              </Link>
              <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="border-2 border-white/80 hover:border-white text-white hover:bg-white/10 rounded-xl h-12 px-6 text-sm font-semibold transition-all">
                Explore Features
              </button>
            </div>

            {/* Dashboard mockup */}
            <motion.div className="mt-6 relative" style={{ y: mockupY }}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.7 }}
                className="rounded-2xl overflow-hidden shadow-2xl border border-border/40"
              >
                <img src={dashboardMockup} alt="UniPlacements Dashboard" className="w-full h-auto" width={1280} height={720} />
              </motion.div>
              <motion.img
                src={education3d}
                alt=""
                className="absolute -top-6 -right-4 w-20 lg:w-28 drop-shadow-lg hidden sm:block"
                animate={{ y: [0, -12, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 6, repeat: Infinity }}
                width={512}
                height={512}
              />
            </motion.div>
          </motion.div>

          {/* Right - Auth Form */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center lg:justify-end lg:sticky lg:top-20 lg:self-start"
          >
            <div className="auth-card fade-in" style={{ margin: 0, width: '100%', maxWidth: '440px', background: 'var(--bg-card)', padding: '2rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--border)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setAuthTab("signin"); setStep(1); }}
                  style={{ flex: 1, background: 'none', border: 'none', fontWeight: 600, fontSize: '1.05rem', color: authTab === "signin" ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'center', transition: 'color 0.2s' }}
                >
                  Sign In
                </button>
                <div style={{ width: '2px', background: 'var(--border)' }}></div>
                <button
                  type="button"
                  onClick={() => { setAuthTab("register"); setStep(1); }}
                  style={{ flex: 1, background: 'none', border: 'none', fontWeight: 600, fontSize: '1.05rem', color: authTab === "register" ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', textAlign: 'center', transition: 'color 0.2s' }}
                >
                  Register
                </button>
              </div>

              <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                {authTab === "signin" ? "Welcome Back" : step === 1 ? "Create Account" : "Verify Email"}
              </h1>
              <p className="subtitle" style={{ marginBottom: '1.8rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                {authTab === "signin" 
                  ? "Sign in to access your placement portal" 
                  : step === 1 
                    ? "Join our placement network today" 
                    : `Enter the 6-digit code sent to ${email}`
                }
              </p>

              <form onSubmit={authTab === "signin" ? handleLogin : step === 1 ? handleSendOTP : handleVerifyOTP}>
                {authTab === "register" && step === 2 ? (
                  <div className="form-group" style={{ textAlign: 'left', marginTop: '1rem' }}>
                    <label style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>One-Time Password (OTP)</label>
                    <input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit OTP" required style={{ width: '100%', padding: '1rem 1.2rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
                  </div>
                ) : (
                  <>
                    {authTab === "register" && (
                      <div className="form-group" style={{ textAlign: 'left' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Full Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" required style={{ width: '100%', padding: '1rem 1.2rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
                      </div>
                    )}
                    {authTab === "register" && (
                      <div className="form-group" style={{ textAlign: 'left', marginTop: '1rem' }}>
                        <label style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Role</label>
                        <select value={role} onChange={(e) => setRole(e.target.value)} required style={{ width: '100%', padding: '1rem 1.2rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}>
                          <option value="student">Student</option>
                          <option value="recruiter">Recruiter</option>
                        </select>
                      </div>
                    )}
                    <div className="form-group" style={{ textAlign: 'left', marginTop: '1rem' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Email Address</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required style={{ width: '100%', padding: '1rem 1.2rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
                    </div>
                    <div className="form-group" style={{ textAlign: 'left', marginTop: '1rem' }}>
                      <label style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Password</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={authTab === "register" ? "Min 6 characters" : "Enter your password"} required style={{ width: '100%', padding: '1rem 1.2rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {authTab === "signin" && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                    <Link to="/forgot-password" style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>Forgot password?</Link>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: (authTab === "register" || step === 2) ? '1.5rem' : '0' }}>
                  {loading 
                    ? (authTab === "signin" ? "Signing In..." : step === 1 ? "Sending OTP..." : "Verifying...") 
                    : (authTab === "signin" ? "Sign In" : step === 1 ? "Create Account" : "Verify & Create")}
                </button>
                  
                {authTab === "register" && step === 2 && (
                  <button type="button" onClick={() => setStep(1)} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: '100%', marginTop: '0.75rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    Back to Signup
                  </button>
                )}
              </form>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="flex justify-center pb-4">
        <div className="animate-scroll-indicator">
          <div className="w-5 h-8 rounded-none border-2 border-muted-foreground/30 flex justify-center pt-1.5">
            <div className="w-1 h-1 rounded-none bg-primary" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
