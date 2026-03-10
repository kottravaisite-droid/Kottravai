import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, ShoppingBag, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProducts } from '@/context/ProductContext';
import { useCart } from '@/context/CartContext';
import toast from 'react-hot-toast';

const GiftBundleBuilder = () => {
    const { addToCart } = useCart();
    const { products, loading } = useProducts();
    const [activeTab, setActiveTab] = useState('All Products');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Scroll Handler for Carousel
    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const { scrollLeft, clientWidth } = scrollRef.current;
            const scrollAmount = clientWidth * 0.8;
            const scrollTo = direction === 'left'
                ? scrollLeft - scrollAmount
                : scrollLeft + scrollAmount;
            scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
        }
    };

    // STEP 2 — FILTER PRODUCTS FOR BUNDLE
    const giftItems = useMemo(() => {
        if (!products) return [];
        let filtered = products.filter(p =>
            p.isGiftBundleItem &&
            p.price > 0 &&
            (p.images && p.images.length > 0)
        );

        if (activeTab === 'Coco Crafts') {
            filtered = filtered.filter(p => p.category === 'Coco Crafts');
        } else if (activeTab === 'Terracotta') {
            filtered = filtered.filter(p => p.category === 'Terracotta Ornaments');
        } else if (activeTab === 'Essential Care') {
            filtered = filtered.filter(p => p.category === 'Essential Care');
        } else if (activeTab === 'Heritage Mixes') {
            filtered = filtered.filter(p => p.category === 'Daily Idly Mix' || p.category === 'Tasty Dosa Mix' || p.category === 'Wholesome Rice Mix');
        }

        return filtered;
    }, [products, activeTab]);

    // Selection state: { productId: quantity }
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});

    const selectedProducts = useMemo(() => {
        return Object.entries(selectedItems)
            .map(([id, quantity]) => {
                const product = products.find(p => p.id === id);
                return product ? { ...product, bundleQuantity: quantity } : null;
            })
            .filter((p): p is any => p !== null);
    }, [selectedItems, products]);

    const finalTotal = useMemo(() => {
        return selectedProducts.reduce((total, p) => total + (p.price * p.bundleQuantity), 0);
    }, [selectedProducts]);

    const handleAddToBundle = (productId: string) => {
        setSelectedItems(prev => ({
            ...prev,
            [productId]: (prev[productId] || 0) + 1
        }));
    };

    const handleUpdateQuantity = (productId: string, delta: number) => {
        setSelectedItems(prev => {
            const newQty = (prev[productId] || 0) + delta;
            if (newQty <= 0) {
                const newState = { ...prev };
                delete newState[productId];
                return newState;
            }
            return { ...prev, [productId]: newQty };
        });
    };

    const handleRemoveFromBundle = (productId: string) => {
        setSelectedItems(prev => {
            const newState = { ...prev };
            delete newState[productId];
            return newState;
        });
    };

    const handleAddBundleToCart = () => {
        if (selectedProducts.length === 0) {
            toast.error('Please add items to your selection first.');
            return;
        }

        selectedProducts.forEach(product => {
            addToCart(product, product.bundleQuantity);
        });

        toast.success(`Items added to cart!`);
        setSelectedItems({});
    };

    const getTabClass = (tab: string) => {
        return `pb-4 uppercase tracking-[0.2em] text-[10px] md:text-xs transition-all duration-300 whitespace-nowrap border-b-2 ${activeTab === tab
            ? 'text-[#8E2A8B] border-[#8E2A8B] font-black'
            : 'text-gray-400 border-transparent font-bold hover:text-gray-600'
            }`;
    };

    const SkeletonCard = () => (
        <div className="bg-white rounded-[24px] p-4 border border-gray-100 shadow-sm animate-pulse min-w-[280px]">
            <div className="aspect-square bg-gray-100 rounded-[16px] mb-4"></div>
            <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                <div className="h-5 bg-gray-100 rounded w-1/3"></div>
                <div className="h-10 bg-gray-100 rounded-xl w-full"></div>
            </div>
        </div>
    );

    return (
        <section className="pt-20 pb-4 bg-white">
            <div className="container mx-auto px-4 max-w-[1240px]">
                {/* Header Row */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
                    <div className="text-left">
                        <h2 className="text-4xl md:text-5xl font-black text-[#1A1A1A] mb-4 tracking-tight">
                            Build Your Gift Set
                        </h2>
                        <p className="text-gray-500 font-medium max-w-xl text-lg">
                            Select items to create a thoughtful gift for your loved ones.
                        </p>
                    </div>
                    <Link to="/shop" className="group flex items-center gap-2 text-[#8E2A8B] font-bold uppercase tracking-widest text-xs hover:gap-4 transition-all pb-1">
                        View All Products <ArrowRight size={16} />
                    </Link>
                </div>

                <div className="flex flex-col lg:flex-row gap-10">
                    {/* LEFT SIDE: PRODUCT CAROUSEL (70%) */}
                    <div className="lg:w-[70%]">
                        {/* Interactive Tabs */}
                        <div className="flex space-x-8 md:space-x-12 mb-10 overflow-x-auto no-scrollbar border-b border-gray-100">
                            {['All Products', 'Coco Crafts', 'Terracotta', 'Essential Care', 'Heritage Mixes'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={getTabClass(tab)}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Carousel Container */}
                        <div className="relative group/carousel">
                            {/* Navigation Arrows */}
                            <button
                                onClick={() => scroll('left')}
                                className="absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-xl border border-gray-100 opacity-0 group-hover/carousel:opacity-100 transition-all hover:bg-[#8E2A8B] hover:text-white"
                                aria-label="Previous items"
                            >
                                <ChevronLeft size={20} />
                            </button>

                            <div
                                ref={scrollRef}
                                className="flex gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth pb-8"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {loading ? (
                                    [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
                                ) : (
                                    giftItems.map((product) => (
                                        <div
                                            key={product.id}
                                            className="min-w-[280px] snap-start"
                                        >
                                            <div className="group bg-white rounded-[24px] p-4 border border-gray-100 shadow-sm transition-all duration-300">
                                                <div className="relative aspect-square overflow-hidden rounded-[16px] mb-4 bg-[#F8F8F8]">
                                                    {/* Primary Image */}
                                                    <img
                                                        src={product.image || (product.images && product.images[0]) || "/placeholder.png"}
                                                        alt={product.name}
                                                        className={`w-full h-full object-cover transition-all duration-500 ${(product.images && product.images.length > 0) ? 'group-hover:opacity-0' : 'group-hover:scale-105'}`}
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.src = "/placeholder.png";
                                                        }}
                                                    />
                                                    {/* Hover Image (First in Gallery) */}
                                                    {product.images && product.images.length > 0 && (
                                                        <img
                                                            src={product.images[0]}
                                                            alt={`${product.name} alternate view`}
                                                            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                                                            loading="lazy"
                                                        />
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <h3 className="font-bold text-[#1A1A1A] text-base line-clamp-2 min-h-[44px]">
                                                        {product.name}
                                                    </h3>
                                                    <p className="text-[#8E2A8B] font-black text-lg">
                                                        ₹{product.price.toLocaleString('en-IN')}
                                                    </p>
                                                    <div className="space-y-2">
                                                        {selectedItems[product.id] ? (
                                                            <button
                                                                onClick={() => handleRemoveFromBundle(product.id)}
                                                                className="w-full py-3 bg-[#8E2A8B] text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2"
                                                            >
                                                                <Minus size={14} /> Remove
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleAddToBundle(product.id)}
                                                                className="w-full py-3 bg-[#F8F8F8] text-[#1A1A1A] font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-[#8E2A8B] hover:text-white transition-all flex items-center justify-center gap-2"
                                                            >
                                                                <Plus size={14} /> Add to Set
                                                            </button>
                                                        )}
                                                        <Link
                                                            to={`/product/${product.slug}`}
                                                            className="w-full py-3 border border-gray-100 text-gray-400 font-black text-[10px] uppercase tracking-widest rounded-xl hover:text-[#8E2A8B] hover:border-[#8E2A8B] transition-all flex items-center justify-center gap-2"
                                                        >
                                                            View Product <ArrowRight size={14} />
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <button
                                onClick={() => scroll('right')}
                                className="absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-xl border border-gray-100 opacity-0 group-hover/carousel:opacity-100 transition-all hover:bg-[#8E2A8B] hover:text-white"
                                aria-label="Next items"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {!loading && giftItems.length === 0 && (
                            <div className="text-center py-20 bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No items found in this category.</p>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDE: SELECTION SUMMARY (30%) */}
                    <div className="lg:w-[30%]">
                        <div className="sticky top-24 bg-[#FAF9F6] rounded-[32px] p-6 border border-gray-100 shadow-sm">
                            <div className="mb-6">
                                <h3 className="text-xl font-black text-[#1A1A1A] mb-1">Your Selection</h3>
                                <p className="text-gray-500 text-xs font-medium">Review items before adding to cart.</p>
                            </div>

                            {/* Selected Items List */}
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar mb-6">
                                {selectedProducts.length === 0 ? (
                                    <div className="text-center py-8 opacity-20 border-2 border-dashed border-gray-200 rounded-2xl">
                                        <ShoppingBag size={32} className="mx-auto mb-2" />
                                        <p className="font-bold text-[10px] uppercase tracking-widest">Empty</p>
                                    </div>
                                ) : (
                                    selectedProducts.map((p) => (
                                        <div key={p.id} className="flex gap-3 items-center bg-white p-2 rounded-xl border border-gray-100">
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                <img src={p.image || (p.images && p.images[0]) || "/placeholder.png"} alt={p.name} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-[#1A1A1A] text-[10px] leading-tight truncate">{p.name}</h4>
                                                <div className="flex items-center justify-between mt-1">
                                                    <p className="text-[#8E2A8B] font-black text-[10px]">₹{p.price}</p>
                                                    <div className="flex items-center bg-gray-50 rounded-md p-0.5 border border-gray-100">
                                                        <button onClick={() => handleUpdateQuantity(p.id, -1)} className="p-0.5 hover:text-[#8E2A8B] transition"><Minus size={8} /></button>
                                                        <span className="w-4 text-center text-[10px] font-black">{p.bundleQuantity}</span>
                                                        <button onClick={() => handleUpdateQuantity(p.id, 1)} className="p-0.5 hover:text-[#8E2A8B] transition"><Plus size={8} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Totals */}
                            <div className="border-t border-dashed border-gray-200 pt-4 space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1A1A1A]">Total Amount</span>
                                    <span className="text-xl font-black text-[#1A1A1A]">₹{finalTotal.toLocaleString('en-IN')}</span>
                                </div>
                            </div>

                            {/* Main CTA */}
                            <button
                                onClick={handleAddBundleToCart}
                                disabled={selectedProducts.length === 0}
                                className={`w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all mt-6 flex items-center justify-center gap-2 shadow-lg ${selectedProducts.length > 0
                                    ? 'bg-[#8E2A8B] text-white hover:bg-black hover:scale-[1.02] active:scale-95 shadow-[#8E2A8B]/10'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                    }`}
                            >
                                <CheckCircle2 size={14} />
                                Add To Cart
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default GiftBundleBuilder;
