import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Home from '@/pages/Home';
import PageViewer from '@/pages/PageViewer';
import BlogList from '@/pages/BlogList';
import BlogDetail from '@/pages/BlogDetail';
import Contact from '@/pages/Contact';
import NotFound from '@/pages/NotFound';
import AboutUs from '@/pages/AboutUs';
import FAQ from '@/pages/FAQ';
import B2B from '@/pages/B2B';
import Shop from '@/pages/Shop';
import Cart from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import ProductDetails from '@/pages/ProductDetails';
import Account from '@/pages/Account';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminLogin from '@/pages/admin/AdminLogin';

import ShippingPolicy from '@/pages/ShippingPolicy';
import RefundPolicy from '@/pages/RefundPolicy';
import TermsOfService from '@/pages/TermsOfService';
import PrivacyPolicy from '@/pages/PrivacyPolicy';

import ScrollToTop from '@/components/ScrollToTop';

import { Toaster } from 'react-hot-toast';
import analytics from '@/utils/analyticsService';

function App() {
    const location = useLocation();
    const [scrolledMilestones, setScrolledMilestones] = useState<number[]>([]);

    // Track Page Views
    useEffect(() => {
        analytics.trackEvent('page_view', {
            path: location.pathname,
            search: location.search,
            title: document.title
        });
        setScrolledMilestones([]); // Reset milestones on navigation
    }, [location]);

    // Track Scroll Depth
    useEffect(() => {
        const handleScroll = () => {
            const h = document.documentElement,
                b = document.body,
                st = 'scrollTop',
                sh = 'scrollHeight';
            const percent = (h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight) * 100;

            [25, 50, 75, 100].forEach(milestone => {
                if (percent >= milestone && !scrolledMilestones.includes(milestone)) {
                    setScrolledMilestones(prev => [...prev, milestone]);
                    analytics.trackEvent('scroll_depth', { depth: `${milestone}%` });
                }
            });
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [scrolledMilestones]);

    return (
        <>
            <ScrollToTop />
            <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:slug" element={<ProductDetails />} />
                <Route path="/category/:slug" element={<Shop />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/account" element={<Account />} />
                <Route path="/about" element={<AboutUs />} />
                <Route path="/b2b" element={<B2B />} />
                <Route path="/faqs" element={<FAQ />} />
                <Route path="/services" element={<PageViewer slugUri="services" />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/shipping-policy" element={<ShippingPolicy />} />
                <Route path="/refund-policy" element={<RefundPolicy />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />

                {/* Blog System */}
                <Route path="/blog" element={<BlogList />} />
                <Route path="/blog/:slug" element={<BlogDetail />} />

                {/* Dynamic Page Fallback */}
                <Route path="/:slug" element={<PageViewer />} />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
                {/* Admin Panel */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminDashboard />} />

            </Routes>
        </>
    );
}

export default App;
