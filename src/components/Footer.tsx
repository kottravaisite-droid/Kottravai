import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Youtube, ArrowRight, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';

const Footer = () => {
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [openSection, setOpenSection] = useState<string | null>(null);

    const toggleSection = (section: string) => {
        if (window.innerWidth < 1024) { // Only toggle on mobile
            setOpenSection(openSection === section ? null : section);
        }
    };

    useEffect(() => {
        const checkScroll = () => {
            if (window.scrollY > 300) {
                setShowScrollTop(true);
            } else {
                setShowScrollTop(false);
            }
        };

        window.addEventListener('scroll', checkScroll);
        return () => window.removeEventListener('scroll', checkScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <footer className="bg-black text-white pt-12 lg:pt-20 pb-10 relative">
            <div className="mx-auto max-w-[1440px] px-6 sm:px-8 md:px-12 lg:px-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-16">
                {/* Col 1: Brand & Address */}
                <div className="space-y-6">
                    <Link to="/" className="inline-block">
                        <img
                            src="/uploads/2026/01/kottravai-logo-final.png"
                            alt="Kottravai"
                            className="h-12 md:h-14 object-contain -ml-3"
                        />
                    </Link>
                    <div className="text-gray-400 text-sm space-y-2 leading-relaxed">
                        <p>
                            Vazhai Incubator<br />
                            S Veerasamy Chettiar college,<br />
                            Puliyangudi - 627855
                        </p>
                        <p className="pt-2">
                            Phone: <a href="tel:+919787030811" className="hover:text-[#d846ef] transition-colors">+91 97870 30811</a>
                        </p>
                    </div>
                </div>

                {/* Col 2: Main Navigation */}
                <div className="border-b border-gray-800 lg:border-none pb-4 lg:pb-0">
                    <button
                        onClick={() => toggleSection('main')}
                        className="w-full flex items-center justify-between lg:block text-left group"
                    >
                        <h4 className="text-lg font-bold lg:mb-8">Main Navigation</h4>
                        <ChevronUp className={`lg:hidden transition-transform duration-300 ${openSection === 'main' ? '' : 'rotate-180'}`} size={20} />
                    </button>
                    <ul className={`lg:block space-y-4 text-sm text-gray-400 mt-4 lg:mt-0 transition-all duration-300 overflow-hidden ${openSection === 'main' ? 'max-h-64 opacity-100' : 'max-h-0 lg:max-h-none opacity-0 lg:opacity-100'}`}>
                        <li><Link to="/" className="hover:text-[#d846ef] transition-colors">Home</Link></li>
                        <li><Link to="/shop" className="hover:text-[#d846ef] transition-colors">Shop By Category</Link></li>
                        <li><Link to="/about" className="hover:text-[#d846ef] transition-colors">Our Story</Link></li>
                        <li><Link to="/contact" className="hover:text-[#d846ef] transition-colors">Contact</Link></li>
                        <li><Link to="/blog" className="hover:text-[#d846ef] transition-colors">Blogs</Link></li>
                    </ul>
                </div>

                {/* Col 3: Useful Links */}
                <div className="border-b border-gray-800 lg:border-none pb-4 lg:pb-0">
                    <button
                        onClick={() => toggleSection('useful')}
                        className="w-full flex items-center justify-between lg:block text-left group"
                    >
                        <h4 className="text-lg font-bold lg:mb-8">Useful Links</h4>
                        <ChevronUp className={`lg:hidden transition-transform duration-300 ${openSection === 'useful' ? '' : 'rotate-180'}`} size={20} />
                    </button>
                    <ul className={`lg:block space-y-4 text-sm text-gray-400 mt-4 lg:mt-0 transition-all duration-300 overflow-hidden ${openSection === 'useful' ? 'max-h-64 opacity-100' : 'max-h-0 lg:max-h-none opacity-0 lg:opacity-100'}`}>
                        <li><Link to="/shipping-policy" className="hover:text-[#d846ef] transition-colors">Shipping Policy</Link></li>
                        <li><Link to="/refund-policy" className="hover:text-[#d846ef] transition-colors">Refund Policy</Link></li>
                        <li><Link to="/terms-of-service" className="hover:text-[#d846ef] transition-colors">Terms Of Service</Link></li>
                        <li><Link to="/privacy-policy" className="hover:text-[#d846ef] transition-colors">Privacy Policy</Link></li>
                    </ul>
                </div>

                {/* Col 4: Let's get in touch */}
                <div className="pt-4 lg:pt-0">
                    <h4 className="text-lg font-bold mb-6">Let's get in touch</h4>
                    <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                        Sign up for our newsletter!
                    </p>
                    <form className="relative mb-8">
                        <input
                            type="email"
                            placeholder="Enter your email..."
                            className="w-full bg-[#1a1a1a] border border-gray-800 rounded-lg pl-4 pr-12 py-3 text-sm text-gray-300 focus:outline-none focus:border-[#d846ef] transition-colors"
                        />
                        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-[#d846ef] hover:text-white transition-all text-black">
                            <ArrowRight size={16} />
                        </button>
                    </form>

                    {/* Social Icons */}
                    <div className="flex space-x-4 lg:space-x-6">
                        <a href="https://www.facebook.com/profile.php?id=61582600756315" className="bg-white rounded-full p-1.5 text-black hover:bg-[#d846ef] hover:text-white transition-colors"><Facebook size={18} /></a>
                        <a href="https://www.youtube.com/@Kottravai_in" className="bg-white rounded-full p-1.5 text-black hover:bg-[#d846ef] hover:text-white transition-colors"><Youtube size={18} /></a>
                        <a href="https://x.com/kottravai_in" className="bg-white rounded-full p-1.5 text-black hover:bg-[#d846ef] hover:text-white transition-colors">
                            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                        </a>
                        <a href="https://www.instagram.com/kottravai_in/" className="bg-white rounded-full p-1.5 text-black hover:bg-[#d846ef] hover:text-white transition-colors"><Instagram size={18} /></a>
                        <a href="https://in.linkedin.com/company/kottravai" className="bg-white rounded-full p-1.5 text-black hover:bg-[#d846ef] hover:text-white transition-colors"><Linkedin size={18} /></a>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-gray-900 mx-auto max-w-[1440px] px-8 md:px-12 lg:px-20 pt-8 text-sm text-gray-500">
                <p className="text-center lg:text-left">© 2025 – Kottravai. All Rights Reserved.</p>
            </div>

            {/* Scroll To Top Button */}
            {showScrollTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-[148px] md:bottom-[92px] right-6 md:right-8 w-10 h-10 md:w-12 md:h-12 border border-gray-100 bg-white rounded-full flex items-center justify-center text-[#b5128f] shadow-2xl transition-all z-[90] hover:scale-110 active:scale-95"
                    aria-label="Scroll to top"
                >
                    <ChevronUp size={24} />
                </button>
            )}
        </footer>
    );
};

export default Footer;
