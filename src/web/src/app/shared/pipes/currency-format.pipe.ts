import { Pipe, PipeTransform } from '@angular/core'; // @angular/core v16.x
import { formatCurrency, getCurrencySymbol } from '@angular/common'; // @angular/common v16.x

/**
 * Constants for currency formatting configuration
 */
const DEFAULT_PIPE_NAME = 'currencyFormat';
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_LOCALE = 'en-US';
const CACHE_SIZE_LIMIT = 1000;
const DECIMAL_DIGITS = 2;

/**
 * CurrencyFormatPipe
 * 
 * A pure Angular pipe that provides standardized currency formatting across the Nexus Platform.
 * Supports multiple currencies and locales with performance optimization through caching.
 * 
 * @example
 * {{ 1234.56 | currencyFormat }}                    // outputs "$1,234.56"
 * {{ 1234.56 | currencyFormat:'EUR':'de-DE' }}      // outputs "1.234,56 €"
 */
@Pipe({
    name: DEFAULT_PIPE_NAME,
    pure: true
})
export class CurrencyFormatPipe implements PipeTransform {
    private readonly defaultCurrency: string;
    private readonly defaultLocale: string;
    private readonly formattedValueCache: Map<string, string>;

    constructor() {
        this.defaultCurrency = DEFAULT_CURRENCY;
        this.defaultLocale = DEFAULT_LOCALE;
        this.formattedValueCache = new Map<string, string>();
    }

    /**
     * Transforms a numeric value into a formatted currency string.
     * 
     * @param value - The numeric value to format
     * @param currencyCode - Optional ISO 4217 currency code (defaults to USD)
     * @param locale - Optional locale identifier (defaults to en-US)
     * @returns Formatted currency string
     * @throws Error if value cannot be formatted
     */
    transform(
        value: number | null | undefined,
        currencyCode?: string,
        locale?: string
    ): string {
        try {
            // Handle null/undefined/NaN values
            if (value === null || value === undefined || isNaN(value)) {
                return '';
            }

            // Generate cache key
            const cacheKey = `${value}-${currencyCode || this.defaultCurrency}-${locale || this.defaultLocale}`;

            // Check cache first
            const cachedValue = this.formattedValueCache.get(cacheKey);
            if (cachedValue) {
                return cachedValue;
            }

            // Determine effective currency and locale
            const effectiveCurrency = currencyCode || this.defaultCurrency;
            const effectiveLocale = locale || this.defaultLocale;

            // Get currency symbol
            const currencySymbol = getCurrencySymbol(effectiveCurrency, 'wide');

            // Format the currency value
            const formattedValue = formatCurrency(
                value,
                effectiveLocale,
                currencySymbol,
                effectiveCurrency,
                `1.${DECIMAL_DIGITS}-${DECIMAL_DIGITS}` // Enforce exactly 2 decimal places
            );

            // Manage cache size
            if (this.formattedValueCache.size >= CACHE_SIZE_LIMIT) {
                const firstKey = this.formattedValueCache.keys().next().value;
                this.formattedValueCache.delete(firstKey);
            }

            // Cache the result
            this.formattedValueCache.set(cacheKey, formattedValue);

            return formattedValue;

        } catch (error) {
            console.error('Currency formatting error:', error);
            // Fallback to basic formatting in case of error
            return `${value?.toFixed(DECIMAL_DIGITS) || ''} ${currencyCode || this.defaultCurrency}`;
        }
    }
}