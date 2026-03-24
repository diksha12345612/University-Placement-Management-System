import Navbar from "@/landing-components/Navbar";
import HeroSection from "@/landing-components/HeroSection";
import PartnersSection from "@/landing-components/PartnersSection";
import FeaturesSection from "@/landing-components/FeaturesSection";
import StatsSection from "@/landing-components/StatsSection";
import RoleFeaturesSection from "@/landing-components/RoleFeaturesSection";
import HowItWorksSection from "@/landing-components/HowItWorksSection";
import TechStackSection from "@/landing-components/TechStackSection";
import TestimonialsSection from "@/landing-components/TestimonialsSection";
import CTASection from "@/landing-components/CTASection";
import Footer from "@/landing-components/Footer";
import VideoBackground from "@/landing-components/VideoBackground";

const Landing = () => {
  return (
    <div className="hero-theme min-h-screen bg-background relative overflow-hidden">
      <VideoBackground />
      <div className="relative z-10">
        <Navbar />
        <HeroSection />
        <PartnersSection />
        <FeaturesSection />
        <StatsSection />
        <RoleFeaturesSection />
        <HowItWorksSection />
        <TechStackSection />
        <TestimonialsSection />
        <CTASection />
        <Footer />
      </div>
    </div>
  );
};

export default Landing;
