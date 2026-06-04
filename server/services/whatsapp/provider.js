const interakt = require('./interakt');
const metaCloud = require('./metaCloud');
const wati = require('./wati');
const gupshup = require('./gupshup');

/**
 * WhatsApp Provider Abstraction Layer
 * Supports sending OTPs via different providers.
 */
class WhatsAppProvider {
  constructor() {
    this.providerName = process.env.WHATSAPP_PROVIDER || 'interakt';
    
    switch (this.providerName.toLowerCase()) {
      case 'metacloud':
        this.provider = metaCloud;
        break;
      case 'wati':
        this.provider = wati;
        break;
      case 'gupshup':
        this.provider = gupshup;
        break;
      case 'interakt':
      default:
        this.provider = interakt;
        break;
    }
  }

  /**
   * Send an OTP to a phone number.
   * @param {string} phone - Phone number with country code.
   * @param {string} otp - The OTP string to send.
   * @returns {Promise<boolean>} True if successful.
   */
  async sendOTP(phone, otp) {
    try {
      console.log(`[WhatsAppProvider] Sending OTP via ${this.providerName} to ${phone}`);
      return await this.provider.sendOTP(phone, otp);
    } catch (error) {
      console.error(`[WhatsAppProvider] Failed to send OTP via ${this.providerName}:`, error.message);
      throw error;
    }
  }

  /**
   * Send an abandoned cart recovery message.
   * @param {string} phone - Phone number with country code.
   * @param {string} strategyName - The name of the recovery strategy.
   * @param {string} productName - The product left in the cart.
   * @param {string} coupon - Optional discount coupon.
   * @returns {Promise<boolean>} True if successful.
   */
  async sendRecoveryMessage(phone, strategyName, productName, coupon) {
    try {
      console.log(`[WhatsAppProvider] Sending Recovery (${strategyName}) via ${this.providerName} to ${phone}`);
      // Fallback or dry-run mock implementation if the provider doesn't strictly implement this yet
      if (typeof this.provider.sendRecoveryMessage === 'function') {
        return await this.provider.sendRecoveryMessage(phone, strategyName, productName, coupon);
      } else {
        console.log(`[WhatsAppProvider] Mock Send (Provider does not implement yet). Product: ${productName}, Coupon: ${coupon}`);
        return true;
      }
    } catch (error) {
      console.error(`[WhatsAppProvider] Failed to send Recovery via ${this.providerName}:`, error.message);
      throw error;
    }
  }
}

module.exports = new WhatsAppProvider();
