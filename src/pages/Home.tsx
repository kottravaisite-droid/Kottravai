import { Helmet } from 'react-helmet-async';
import MainLayout from '@/layouts/MainLayout';
import HeroSlider from '@/components/home/HeroSlider';
import BestSellers from '@/components/home/BestSellers';

import JournalSection from '@/components/home/JournalSection';
import Testimonials from '@/components/home/Testimonials';
import ValueProps from '@/components/home/ValueProps';
import GiftBundleBuilder from '@/components/home/GiftBundleBuilder';
import GiftHampers from '@/components/home/GiftHampers';

const Home = () => {
    return (
        <MainLayout>
            <Helmet>
                <title>Kottravai | Handmade Crafts, Eco Products & Traditional Food Mixes.</title>
                <meta name="description" content="Kottravai offers premium handcrafted terracotta jewellery, heritage mixes, and essential care products. Shop our exclusive collection today." />
            </Helmet>

            {/* 1. Hero Section */}
            <HeroSlider />

            {/* 2. Value Props / Trust Indicators */}
            {/* (Kept for existing layout logic) */}

            {/* 3. Best Sellers */}
            <BestSellers />

            {/* 4. Gift Bundle Builder Section */}
            <GiftBundleBuilder />

            {/* Banner Section */}
            <div className="w-full py-8 px-4 md:px-8">
                <div className="max-w-[1240px] mx-auto">
                    <a
                        href="https://whatsapp.com/channel/0029VbAxfDt6rsQwQdzLjS2m"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:opacity-95 transition-opacity"
                    >
                        <img
                            src="/whatsapp-banner.png"
                            alt="Join Kottravai WhatsApp Community"
                            className="w-full h-auto object-cover shadow-sm"
                            loading="lazy"
                        />
                    </a>
                </div>
            </div>

            {/* 5. Curated Gift Hampers */}
            <GiftHampers />

            {/* 6. The Kottravai Journal */}
            <JournalSection />





            {/* 8. Testimonials */}
            <Testimonials />

            {/* 9. Bottom Value Props */}
            <ValueProps />

        </MainLayout>
    );
};

export default Home;
