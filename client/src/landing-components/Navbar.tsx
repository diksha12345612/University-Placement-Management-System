import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";

const navLinks = ["Home", "Features", "How It Works", "Testimonials"];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("Home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "shadow-lg bg-background/95 backdrop-blur-md border-b border-border/50 text-foreground" : "bg-transparent text-white border-b border-transparent"}`}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4 lg:px-8">
        <button className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className={`font-display font-bold text-lg tracking-tight ${scrolled ? 'text-foreground' : 'text-white'}`}>
            UniPlacements
          </span>
        </button>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <button
              key={link}
              onClick={() => {
                setActive(link);
                document.getElementById(link.toLowerCase().replace(/\s/g, "-"))?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                active === link
                  ? (scrolled ? "bg-blue-600/10 text-blue-600" : "bg-white/20 text-white")
                  : (scrolled ? "text-muted-foreground hover:text-foreground hover:bg-secondary" : "text-white/80 hover:text-white hover:bg-white/10")
              }`}
            >
              {link}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login" className={`hidden sm:block text-sm font-medium transition-colors ${scrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/80 hover:text-white'}`}>
            Login
          </Link>
          <Link to="/register" className={`text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center ${scrolled ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'}`}>
            Get Started
          </Link>
          <button className={`md:hidden p-2 rounded-xl transition-colors ${scrolled ? 'hover:bg-secondary text-foreground' : 'hover:bg-white/10 text-white'}`} onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className={`md:hidden border-t px-4 pb-4 ${scrolled ? 'border-border/50 bg-background' : 'border-white/20 bg-black/40 backdrop-blur-lg'}`}
        >
          {navLinks.map((link) => (
            <button
              key={link}
              onClick={() => {
                setActive(link);
                setMobileOpen(false);
                document.getElementById(link.toLowerCase().replace(/\s/g, "-"))?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`block w-full text-left px-4 py-3 text-sm font-medium ${scrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/80 hover:text-white'}`}
            >
              {link}
            </button>
          ))}
        </motion.div>
      )}
    </motion.nav>
  );
};

export default Navbar;
