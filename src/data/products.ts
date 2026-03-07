
// Review Interface
export interface Review {
    id: string;
    userName: string;
    email?: string; // Added to match UI
    rating: number; // 1-5
    comment: string;
    date: string; // ISO string
}

// Product Variant Interface
export interface ProductVariant {
    weight: string;
    price: number;
    images?: string[];
}

// Product Interface
export interface Product {
    id: string;
    name: string;
    price: number;
    category: string;
    image: string;
    slug: string;
    categorySlug?: string;
    shortDescription?: string;
    description?: string;
    keyFeatures?: string[];
    features?: string[]; // Specifications (Key: Value)
    images?: string[];
    reviews?: Review[]; // Array of reviews
    stock?: number;
    isBestSeller?: boolean;
    isGiftBundleItem?: boolean;
    isCustomRequest?: boolean;
    defaultFormFields?: Array<{
        id: string;
        label: string;
        placeholder?: string;
        type: 'text' | 'email' | 'tel' | 'file' | 'textarea' | 'number';
        required: boolean;
        isDefault: boolean;
    }>;
    customFormConfig?: Array<{
        id: string;
        label: string;
        type: 'text' | 'textarea' | 'number';
        placeholder?: string;
        required?: boolean;
    }>;
    variants?: ProductVariant[];
    createdAt?: string;
    salesCount?: number;
    rating?: number;
}

// Sample product to visualize changes immediately
export const products: Product[] = [
    {
        id: '1',
        name: 'Handcrafted Coconut Shell Cup',
        price: 450,
        category: 'Coco Crafts',
        categorySlug: 'coco-crafts',
        image: 'https://images.unsplash.com/photo-1596436065565-dfc49cb376dc?auto=format&fit=crop&q=80&w=800',
        slug: 'handcrafted-coconut-shell-cup',
        shortDescription: 'Eco-friendly, sustainable, and handcrafted coconut shell cup perfect for your daily beverages.',
        description: 'Experience the rustic charm of nature with our Handcrafted Coconut Shell Cup. Meticulously polished and treated with natural oils, this cup is not just a vessel but a piece of art. It is perfect for serving herbal teas, coffee, or even cool refreshing drinks. Being 100% natural, it adds an earthy touch to your kitchen collection.',
        keyFeatures: [
            'Made from 100% natural and reclaimed coconut shells',
            'Handcrafted by skilled rural artisans',
            'Comes with a fitted lid and curved natural handle',
            'Stable round base for safe placement',
            'Eco-friendly, biodegradable & plastic-free',
            'Lightweight, durable & sustainably sourced',
            'Ideal for serving herbal drinks, water, and traditional beverages',
            'Perfect as rustic kitchen décor or handmade gifting',
            'Retains natural coconut shell patterns for an authentic look'
        ],
        features: [
            'Material: 100% Natural Coconut Shell',
            'Capacity: 250ml - 300ml (Approx)',
            'Finish: Polished with Natural Coconut Oil',
            'Weight: 150g',
            'Care Instructions: Hand wash only, do not use in microwave'
        ],
        images: [
            'https://images.unsplash.com/photo-1628102491629-778571d893a3?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1614737662709-64eb772d1742?auto=format&fit=crop&q=80&w=800'
        ],
        reviews: []
    },
    {
        id: '2',
        name: 'Custom Terracotta Planter',
        price: 0,
        category: 'Terracotta Ornaments',
        categorySlug: 'terracotta-ornaments',
        image: 'https://images.unsplash.com/photo-1459156212016-c812468e2115?auto=format&fit=crop&q=80&w=800',
        slug: 'custom-terracotta-planter',
        shortDescription: 'Designed by you, crafted by us. Create a unique terracotta piece for your home.',
        description: 'Have a specific design in mind? Our skilled artisans can bring your vision to life. Whether it is a specific size, shape, or pattern, submit your request and we will craft a custom terracotta masterpiece just for you.',
        keyFeatures: [
            'Fully customizable dimensions and designs',
            'Hand-molded by master potters',
            'Natural, breathable terracotta clay',
            'Weather-resistant for indoor or outdoor use'
        ],
        features: [
            'Material: Natural Clay',
            'Turnaround Time: 2-3 Weeks',
            'Minimum Order: 1 Unit'
        ],
        images: [],
        reviews: [],
        isCustomRequest: true,
        defaultFormFields: [
            { id: 'name', label: 'Your Name', required: true, type: 'text', isDefault: true },
            { id: 'phone', label: 'Phone Number', required: true, type: 'tel', isDefault: true },
            { id: 'email', label: 'Email Address', required: true, type: 'email', isDefault: true },
        ],
        customFormConfig: [
            { id: 'dimensions', label: 'Approximate Dimensions (H x W)', type: 'text', placeholder: 'e.g. 12in x 8in' },
            { id: 'quantity', label: 'Quantity Needed', type: 'number', placeholder: '1' }
        ]
    },
    {
        id: '3',
        name: 'Poondu Idli Podi',
        price: 100,
        category: 'Daily Idly Mix',
        categorySlug: 'daily-idly-mix',
        image: 'https://images.unsplash.com/photo-1589301760557-01e304b281f9?auto=format&fit=crop&q=80&w=800',
        slug: 'poondu-idli-podi',
        shortDescription: 'Flavorful Poondu (garlic) idli podi available in 50g & 100g packs for a spicy and traditional South Indian side dish.',
        description: 'Our Poondu Idli Podi is a fiery and flavorful spice blend made from roasted lentils, dried red chilies, and generous amounts of garlic. It is the perfect accompaniment to hot fluffy idlis or crispy dosas. Just mix with gingelly oil or ghee and enjoy the authentic taste of South India.',
        keyFeatures: [
            'Authentic Homemade Recipe',
            'Rich Garlic Flavor',
            'No Artificial Preservatives',
            'Freshly Ground Spices'
        ],
        features: [
            'Ingredients: Urad Dal, Chana Dal, Red Chilies, Garlic, Salt, Curry Leaves',
            'Shelf Life: 6 Months',
            'Storage: Air-tight container'
        ],
        images: [],
        variants: [
            { weight: '50', price: 100 },
            { weight: '100', price: 200 }
        ],
        reviews: []
    }
];

export const categories = [
    // --- Parent Categories ---
    { name: 'Handicrafts', count: 0, slug: 'handicrafts' },
    { name: 'Heritage Mixes', count: 0, slug: 'heritage-mixes' },
    { name: 'Instant Nourish', count: 0, slug: 'instant-nourish' },
    { name: 'Essential Care', count: 0, slug: 'essential-care' },
    { name: 'Signature Kits', count: 0, slug: 'signature-kits' },

    // --- Sub Categories: Handicrafts ---
    { name: 'Coco Crafts', count: 0, slug: 'coco-crafts', parent: 'handicrafts' },
    { name: 'Terracotta Ornaments', count: 0, slug: 'terracotta-ornaments', parent: 'handicrafts' },
    { name: 'Banana Fibre Essentials', count: 0, slug: 'banana-fibre-essentials', parent: 'handicrafts' },
    { name: 'Handwoven Crochet', count: 0, slug: 'handwoven-crochet', parent: 'handicrafts' },

    // --- Sub Categories: Heritage Mixes ---
    { name: 'Daily Idly Mix', count: 0, slug: 'daily-idly-mix', parent: 'heritage-mixes' },
    { name: 'Tasty Dosa Mix', count: 0, slug: 'tasty-dosa-mix', parent: 'heritage-mixes' },
    { name: 'Wholesome Rice Mix', count: 0, slug: 'wholesome-rice-mix', parent: 'heritage-mixes' }
];
