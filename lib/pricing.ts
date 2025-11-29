// Pricing calculation utilities shared across components

export interface PricingPackage {
  id: string;
  name: string;
  maxMinutes: number;
  monthlyPrice: number;
}

export const PRICING_PACKAGES: PricingPackage[] = [
  { id: 'starter', name: 'Starter', maxMinutes: 500, monthlyPrice: 199.99 },
  { id: 'growth', name: 'Growth', maxMinutes: 1500, monthlyPrice: 549.99 },
  { id: 'professional', name: 'Professional', maxMinutes: 4000, monthlyPrice: 1199.99 },
  { id: 'enterprise', name: 'Enterprise', maxMinutes: Infinity, monthlyPrice: 2499.99 },
];

/**
 * Calculate total minutes per month based on call volume and duration
 * Assumes 21.67 business days per month (Monday-Friday, excluding weekends)
 * This represents the average: ~4.33 weeks per month × 5 business days = 21.67 days
 */
export function calculateTotalMinutes(callVolume: string | null, callDuration: string | null): number {
  if (!callVolume || !callDuration) return 0;
  const volume = parseFloat(callVolume);
  const duration = parseFloat(callDuration);
  if (isNaN(volume) || isNaN(duration)) return 0;
  // Total minutes = calls per day × minutes per call × 21.67 business days per month
  const BUSINESS_DAYS_PER_MONTH = 21.67;
  return volume * duration * BUSINESS_DAYS_PER_MONTH;
}

/**
 * Determine recommended package based on total minutes
 */
export function getRecommendedPackage(totalMinutes: number): PricingPackage {
  for (const pkg of PRICING_PACKAGES) {
    if (totalMinutes <= pkg.maxMinutes) {
      return pkg;
    }
  }
  return PRICING_PACKAGES[PRICING_PACKAGES.length - 1]; // Enterprise
}

