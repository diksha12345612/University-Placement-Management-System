import { GraduationCap } from "lucide-react";
import { FiGithub, FiLinkedin, FiMail } from "react-icons/fi";

const footerLinks = {
  Product: ["Features", "Pricing", "Integrations", "Changelog"],
  Company: ["About", "Blog", "Careers", "Press"],
  Resources: ["Documentation", "Help Center", "Community", "API"],
  Legal: ["Privacy", "Terms", "Cookie Policy", "GDPR"],
};

const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-secondary/20 pt-16 pb-8">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-lg text-foreground">UniPlacements</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Empowering campus recruitment with intelligent placement management.
            </p>
            <div className="flex gap-3">
              {[FiGithub, FiLinkedin, FiMail].map((Icon, i) => (
                <button
                  key={i}
                  className="w-9 h-9 rounded-xl bg-secondary hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center text-muted-foreground"
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-display font-semibold text-sm text-foreground mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © 2026 UniPlacements. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built with ❤️ for campuses everywhere
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
