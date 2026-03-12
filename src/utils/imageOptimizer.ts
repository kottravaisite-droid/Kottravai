/**
 * Utility to optimize Supabase Storage URLs by adding transformation parameters.
 * Helps reduce bandwidth usage (egress) by requesting resized versions of images.
 */

interface ImageOptions {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'origin';
    resize?: 'cover' | 'contain' | 'fill';
}

export const getOptimizedImage = (url: string | undefined, _options: ImageOptions = {}) => {
    // SUPABASE FREE TIER DOES NOT SUPPORT IMAGE TRANSFORMATIONS
    // Reverting to direct URLs to fix broken images
    return url || '';

};

/**
 * Standard sizes for common UI elements
 */
export const IMAGE_SIZES = {
    THUMBNAIL: { width: 150, quality: 60 },
    CARD: { width: 400, quality: 75 },
    HERO: { width: 1200, quality: 80 },
    PRODUCT_DETAIL: { width: 800, quality: 80 }
};
