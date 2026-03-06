import { Link } from 'react-router-dom';
import { ShoppingBag, ChevronDown, X } from 'lucide-react';
import analytics from '@/utils/analyticsService';

interface FilterSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    categories: any[];
    products: any[];
    categoryCounts: Record<string, number>;
    slug?: string;
    priceRange: [number, number];
    setPriceRange: (range: [number, number]) => void;
    expandedCategory: string | null;
    setExpandedCategory: (slug: string | null) => void;
    searchQuery: string;
    totalProductsCount: number;
}

const FilterSidebar = ({
    isOpen,
    onClose,
    categories,
    products,
    categoryCounts,
    slug,
    priceRange,
    setPriceRange,
    expandedCategory,
    setExpandedCategory,
    searchQuery,
    totalProductsCount
}: FilterSidebarProps) => {
    return (
        <>
            {/* Backdrop Overlay */}
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Filter Panel */}
            <div
                className={`fixed z-[110] bg-white shadow-2xl transition-transform duration-300 ease-in-out overflow-y-auto custom-scrollbar
                    /* Mobile: Bottom Drawer */
                    bottom-0 left-0 w-full h-[85vh] rounded-t-[2.5rem] translate-y-full
                    /* Desktop: Left Panel */
                    lg:top-0 lg:left-0 lg:h-full lg:w-[320px] lg:rounded-none lg:-translate-x-full lg:translate-y-0
                    ${isOpen ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:-translate-x-full'}`}
            >
                {/* Mobile Drag Handle */}
                <div className="lg:hidden w-full flex justify-center pt-4 pb-2">
                    <div className="w-12 h-1.5 bg-gray-100 rounded-full"></div>
                </div>

                <div className="p-6 pt-2 lg:pt-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-[#b5128f] rounded-full"></div>
                            <h3 className="font-bold text-2xl text-[#2D1B4E] tracking-tight">Filters</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Clear All Button */}
                    {(slug || priceRange[0] !== 50 || priceRange[1] !== 1000 || searchQuery) && (
                        <div className="mb-6">
                            <Link
                                to="/shop"
                                className="block w-full py-3 rounded-xl border border-[#b5128f]/20 text-center text-xs font-black uppercase tracking-widest text-[#b5128f] hover:bg-[#b5128f]/5 transition-colors"
                                onClick={() => {
                                    setPriceRange([50, 1000]);
                                    setExpandedCategory(null);
                                    onClose();
                                }}
                            >
                                Clear All Filters
                            </Link>
                        </div>
                    )}

                    {/* Categories Section */}
                    <div className="mb-10">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 px-1">Categories</h4>
                        <ul className="space-y-2">
                            <li className="group/item">
                                <Link to="/shop"
                                    className={`flex justify-between items-center p-3 rounded-xl transition-all duration-300 ${!slug ? 'bg-[#b5128f]/10 text-[#b5128f]' : 'text-[#2D1B4E] hover:bg-gray-50'}`}
                                    onClick={() => {
                                        setExpandedCategory(null);
                                        onClose();
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg transition-colors ${!slug ? 'bg-[#b5128f]/10' : 'bg-gray-100 group-hover/item:bg-white'}`}>
                                            <ShoppingBag size={16} className={!slug ? 'text-[#b5128f]' : 'text-gray-400'} />
                                        </div>
                                        <span className={`font-bold text-sm ${!slug ? 'text-[#b5128f]' : 'text-gray-700'}`}>All Products</span>
                                    </div>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${!slug ? 'bg-[#b5128f] text-white' : 'bg-gray-100 text-gray-400'}`}>
                                        {products.length}
                                    </span>
                                </Link>
                            </li>

                            {categories.filter(c => !c.parent).map((parent) => {
                                const isExpanded = expandedCategory === parent.slug;
                                const isActive = slug === parent.slug;
                                const hasChildren = categories.some(c => c.parent === parent.slug);
                                const parentCount = categoryCounts[`p-${parent.slug}`] || 0;

                                return (
                                    <div key={parent.slug} className="pt-1">
                                        <div className="group/parent flex items-center">
                                            <Link
                                                to={`/category/${parent.slug}`}
                                                className={`flex items-center justify-between flex-1 p-3 rounded-xl transition-all duration-300 ${isActive ? 'bg-[#b5128f]/10 text-[#b5128f]' : 'text-[#2D1B4E] hover:bg-gray-50'}`}
                                                onClick={() => {
                                                    analytics.trackEvent('filter_used', { type: 'category', value: parent.slug });
                                                    if (hasChildren) {
                                                        setExpandedCategory(parent.slug === expandedCategory ? null : parent.slug);
                                                    } else {
                                                        onClose();
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-bold text-sm ${isActive ? 'text-[#b5128f]' : 'text-gray-700'}`}>{parent.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-[#b5128f] text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                        {parentCount}
                                                    </span>
                                                    {hasChildren && (
                                                        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                            <ChevronDown size={14} className={isActive ? 'text-[#b5128f]' : 'text-gray-400'} />
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>
                                        </div>

                                        {/* Subcategories Accordion */}
                                        <div className={`mt-1 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none'}`}>
                                            <ul className="pl-6 space-y-1 relative before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-3 before:w-0.5 before:bg-gray-100 before:rounded-full">
                                                {categories.filter(c => c.parent === parent.slug).map(child => {
                                                    const isChildActive = slug === child.slug;
                                                    return (
                                                        <li key={child.slug}>
                                                            <Link
                                                                to={`/category/${child.slug}`}
                                                                className={`group/child flex justify-between items-center p-2 rounded-lg text-xs transition-colors ${isChildActive ? 'text-[#b5128f] font-bold bg-[#b5128f]/5' : 'text-gray-500 hover:text-[#b5128f] hover:bg-gray-50'}`}
                                                                onClick={() => {
                                                                    analytics.trackEvent('filter_used', { type: 'subcategory', value: child.slug });
                                                                    onClose();
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-1 h-1 rounded-full transition-all ${isChildActive ? 'bg-[#b5128f] scale-150' : 'bg-gray-300 group-hover/child:bg-[#b5128f]'}`}></div>
                                                                    <span>{child.name}</span>
                                                                </div>
                                                                <span className={`text-[9px] font-medium ${isChildActive ? 'text-[#b5128f]' : 'text-gray-400'}`}>
                                                                    {categoryCounts[child.slug] || 0}
                                                                </span>
                                                            </Link>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    </div>
                                );
                            })}
                        </ul>
                    </div>

                    {/* Price Range Section */}
                    <div className="mb-10">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 px-1">Price Range</h4>
                        <div className="px-1">
                            <div className="relative pt-6 pb-2">
                                <input
                                    type="range"
                                    min="50" max="1000"
                                    step="10"
                                    value={priceRange[1]}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        setPriceRange([priceRange[0], val]);
                                        analytics.trackEvent('filter_used', { type: 'price_range', max_price: val });
                                    }}
                                    className="w-full accent-[#b5128f] h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#b5128f]/20 transition-all"
                                />
                                <div className="flex justify-between mt-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Min Price</span>
                                        <div className="flex items-center text-sm font-bold text-[#2D1B4E] bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                            <span className="text-gray-400 mr-1 text-[10px]">₹</span>
                                            <input type="number" value={priceRange[0]} onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])} className="bg-transparent border-none p-0 focus:ring-0 w-12 text-sm" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Max Price</span>
                                        <div className="flex items-center text-sm font-bold text-[#b5128f] bg-[#b5128f]/5 px-3 py-1.5 rounded-lg border border-[#b5128f]/10">
                                            <span className="mr-1 text-[10px]">₹</span>
                                            <input type="number" value={priceRange[1]} onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 0])} className="bg-transparent border-none p-0 focus:ring-0 w-16 text-sm text-right font-black" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-full mt-6 py-4 bg-[#2D1B4E] text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-[#2D1B4E]/10"
                            >
                                Show {totalProductsCount} Products
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default FilterSidebar;
