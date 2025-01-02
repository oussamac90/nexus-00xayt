import { Pipe, PipeTransform } from '@angular/core';

/**
 * Units array for file size conversion, using standard binary units
 * Ordered from smallest to largest: Bytes, Kilobytes, Megabytes, Gigabytes, Terabytes
 */
const UNITS: string[] = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
 * Default decimal precision for formatted file sizes
 */
const DEFAULT_PRECISION = 2;

/**
 * Angular pipe that formats numeric byte values into human-readable file sizes
 * with appropriate units and precision.
 * 
 * Features:
 * - Caches results for improved performance
 * - Handles edge cases (zero, negative values, invalid inputs)
 * - Supports configurable decimal precision
 * - Uses binary conversion (1024) for accurate file size representation
 * - Implements proper locale-aware number formatting
 * 
 * @example
 * {{ 1024 | fileSize }} // outputs "1 KB"
 * {{ 1536 | fileSize:1 }} // outputs "1.5 KB"
 * 
 * @version 16.x
 */
@Pipe({
  name: 'fileSize',
  pure: true // Marking as pure for better performance
})
export class FileSizePipe implements PipeTransform {
  /**
   * Cache for storing previously calculated file size strings
   * Key format: `${bytes}-${precision}`
   */
  private readonly cache: Map<string, string> = new Map();

  /**
   * Maximum number of entries to store in cache to prevent memory leaks
   */
  private readonly MAX_CACHE_SIZE = 1000;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Transforms a byte value into a human-readable file size string.
   * 
   * @param bytes - The file size in bytes to format
   * @param precision - Number of decimal places to show (default: 2)
   * @returns Formatted file size string with appropriate unit
   * @throws Error if input is not a valid number
   */
  transform(bytes: number, precision: number = DEFAULT_PRECISION): string {
    try {
      // Generate cache key
      const cacheKey = `${bytes}-${precision}`;

      // Return cached value if available
      const cachedResult = this.cache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Validate input
      if (typeof bytes !== 'number' || isNaN(bytes)) {
        return '0 B';
      }

      // Handle zero and negative cases
      if (bytes <= 0) {
        return '0 B';
      }

      // Calculate the appropriate unit index using logarithmic calculation
      const unitIndex = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        UNITS.length - 1
      );

      // Convert to the selected unit
      const size = bytes / Math.pow(1024, unitIndex);

      // Format the number with proper precision and localization
      const formattedSize = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      }).format(size);

      // Combine size with unit
      const result = `${formattedSize} ${UNITS[unitIndex]}`;

      // Cache the result if cache isn't too large
      if (this.cache.size < this.MAX_CACHE_SIZE) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      console.error('Error in FileSizePipe:', error);
      return '0 B';
    }
  }
}