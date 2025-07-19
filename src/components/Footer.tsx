// src/components/Footer.tsx
export default function Footer() {
  return (
    <footer className="site-footer fixed bottom-0 left-0 w-full bg-card-bg-color border-t border-card-hover-bg-color z-40">
      <div className="footer-content max-w-7xl mx-auto px-4 py-6">
        <div className="text-center">
          <p className="copyright text-secondary-text-color text-sm mb-2 font-body">
            © 2025 kr4.pro Neuromusic Production. All rights reserved.
          </p>
          <div className="contact-info">
            <p className="text-secondary-text-color text-sm font-body">
              Contact us: <a href="mailto:hey@kr4.pro" className="email-link text-accent-color hover:text-green-400 transition-colors underline">hey@kr4.pro</a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
