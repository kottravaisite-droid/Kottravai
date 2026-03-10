const supabase = require('../supabase');

/**
 * HARDENED DETERMINISTIC SHIPPING SERVICE
 * Single Source of Truth for Shipping Rules with Locking Cache
 */

let zoneCache = null;
let lastUpdate = 0;
let refreshPromise = null;
const CACHE_TTL = 3600000; // 1 hour

/**
 * Refreshes the in-memory cache of shipping zones with promise-based locking.
 * Prevents "thundering herd" DB spikes under high concurrency.
 */
const refreshShippingCache = async () => {
    // Return existing promise if already refreshing
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        try {
            const { data: zones, error } = await supabase
                .from('shipping_zones')
                .select('*')
                .eq('is_active', true)
                .order('is_fallback', { ascending: true }); // Fallback last

            if (error) {
                console.error('❌ Failed to load shipping zones into cache:', error.message);
                throw new Error('Shipping configuration unavailable');
            }

            if (!zones || zones.length === 0) {
                console.error('❌ CRITICAL: No shipping zones found in database.');
                throw new Error('SHIPPING_CONFIG_CRITICAL_MISSING');
            }

            zoneCache = zones;
            lastUpdate = Date.now();
            console.log(`📦 Shipping zones cache reloaded successfully at ${new Date().toISOString()}`);
            return zoneCache;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

/**
 * Safely calculates shipping charges using cached rules and integer math.
 * 
 * @param {string} state - Destination state
 * @param {number} cartTotal - Subtotal after discounts
 * @returns {Promise<Object>} Final shipping results
 */
const calculateShipping = async (state, cartTotal) => {
    // 1. Ensure cache is fresh (with Locking)
    if (!zoneCache || (Date.now() - lastUpdate > CACHE_TTL)) {
        await refreshShippingCache();
    }

    const amount = Number(cartTotal);
    if (isNaN(amount)) throw new Error('INVALID_SUBTOTAL_PROVIDED');

    // 2. STRICT DETERMINISTIC ZONE MATCHING
    // Normalization: Remove whitespace and lowercase for canonical comparison
    const normalizedInput = state ? state.trim().toLowerCase() : '';

    // Search for a specific zone match using EXACT equality (===)
    // No includes(), no startsWith(), no fuzzy logic.
    let matchedZone = zoneCache.find(z => {
        if (!z.states || !Array.isArray(z.states)) return false;

        // Final Enforcer Check: Does the input exactly match any state in the zone?
        return z.states.some(s => {
            const normalizedZoneState = s ? s.trim().toLowerCase() : '';
            return normalizedZoneState === normalizedInput;
        });
    });

    // 3. ROBUST EXPLICIT FALLBACK (Zone 3 Authority)
    // If no strict match is found, apply the designated fallback zone (Zone 3)
    if (!matchedZone) {
        matchedZone = zoneCache.find(z => z.is_fallback === true);
    }

    if (!matchedZone) {
        throw new Error(`Shipping unavailable for state: ${state}. No fallback zone configured.`);
    }

    // 4. Strict Financial Calculation (Cent-based integers)
    const thresholdCents = Math.round(parseFloat(matchedZone.free_shipping_threshold) * 100);
    const chargeCents = Math.round(parseFloat(matchedZone.shipping_charge) * 100);
    const subtotalCents = Math.round(amount * 100);

    const isFree = subtotalCents >= thresholdCents;
    const finalChargeCents = isFree ? 0 : chargeCents;
    const remainingCents = isFree ? 0 : Math.max(0, thresholdCents - subtotalCents);

    return {
        zoneName: matchedZone.zone_name,
        shippingFee: finalChargeCents / 100, // Renamed from shippingCharge
        isFreeShipping: isFree,
        threshold: thresholdCents / 100,      // Renamed from freeShippingThreshold
        remainingForFreeShipping: remainingCents / 100, // Renamed from remainingAmount
        currency: "INR"
    };
};

module.exports = {
    calculateShipping,
    refreshShippingCache
};
