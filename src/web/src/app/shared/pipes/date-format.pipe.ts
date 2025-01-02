/**
 * @fileoverview Angular pipe for standardized date formatting across the Nexus Platform
 * with support for internationalization, timezone handling, and accessibility.
 * Implements consistent date display patterns for international trade operations.
 * @version Angular 16.x
 */

import { Pipe, PipeTransform } from '@angular/core'; // v16.x
import { formatDate, DATE_FORMATS } from '../utils/date.utils';

/**
 * Angular pipe that transforms date values into formatted strings using predefined
 * or custom formats. Supports internationalization, timezone handling, and includes
 * caching for performance optimization.
 * 
 * @example
 * // Using predefined format
 * {{ orderDate | dateFormat:'orderTimeline' }}
 * 
 * // Using custom format with timezone
 * {{ shipmentDate | dateFormat:'yyyy-MM-dd HH:mm':'UTC':'fr-FR' }}
 */
@Pipe({
  name: 'dateFormat',
  pure: true // Marking as pure for better performance with immutable inputs
})
export class DateFormatPipe implements PipeTransform {
  // Cache for formatted date strings to improve performance
  private readonly _cache = new Map<string, string>();

  /**
   * Transforms a date value into a formatted string based on specified parameters.
   * Implements caching for improved performance and handles invalid inputs gracefully.
   * 
   * @param value - The date value to format (Date object, ISO string, or timestamp)
   * @param format - Predefined format key or custom format pattern (defaults to 'medium')
   * @param timezone - Target timezone identifier (defaults to 'UTC')
   * @param locale - Locale identifier for internationalization (defaults to 'en-US')
   * @returns Formatted date string or empty string if input is invalid
   */
  transform(
    value: Date | string | number | null,
    format: string | keyof typeof DATE_FORMATS = 'medium',
    timezone: string = 'UTC',
    locale: string = 'en-US'
  ): string {
    if (!value) {
      return '';
    }

    // Generate cache key based on input parameters
    const cacheKey = `${value.toString()}-${format}-${timezone}-${locale}`;

    // Return cached result if available
    const cachedResult = this._cache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      // Determine format string from DATE_FORMATS or use custom pattern
      const formatString = format in DATE_FORMATS 
        ? DATE_FORMATS[format as keyof typeof DATE_FORMATS]
        : format;

      // Handle relative time format separately
      if (formatString === 'relative') {
        // Relative time formatting is handled by date.utils
        return formatDate(value, DATE_FORMATS.medium, { timezone });
      }

      // Format date using utility function
      const result = formatDate(value, formatString, {
        timezone,
        locale: locale
      });

      // Cache successful result
      if (result) {
        this._cache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      console.error('DateFormatPipe: Error formatting date:', error);
      return '';
    }
  }
}