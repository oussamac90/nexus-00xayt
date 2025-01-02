/**
 * @fileoverview Date utility functions for standardized date formatting and manipulation
 * across the Nexus Platform web application. Provides comprehensive support for
 * international trade operations with timezone-aware date handling and localization.
 * @version date-fns@2.30.0
 */

import { format, formatDistance, parseISO, isValid } from 'date-fns'; // v2.30.0
import { enUS, Locale } from 'date-fns/locale'; // v2.30.0

// Default format patterns for consistent date display
export const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';
export const DEFAULT_DATETIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';
export const DEFAULT_TIME_FORMAT = 'HH:mm:ss';

// Predefined format patterns for different use cases
export const DATE_FORMATS = {
  short: 'MM/dd/yyyy',
  medium: 'MMM d, yyyy',
  long: 'MMMM d, yyyy',
  iso: 'yyyy-MM-dd',
  timestamp: 'yyyy-MM-dd HH:mm:ss',
  relative: 'relative',
  orderTimeline: 'MMM d, yyyy HH:mm'
} as const;

/**
 * Interface for date formatting options
 */
interface DateFormatOptions {
  locale?: Locale;
  timezone?: string;
}

/**
 * Interface for relative time options
 */
interface RelativeTimeOptions {
  locale?: Locale;
  addSuffix?: boolean;
}

/**
 * Formats a date value according to the specified format string with comprehensive
 * error handling and timezone support.
 * 
 * @param value - Date value to format (Date object, ISO string, or timestamp)
 * @param formatStr - Format string pattern (defaults to DEFAULT_DATE_FORMAT)
 * @param options - Optional formatting configuration
 * @returns Formatted date string or empty string if invalid
 */
export function formatDate(
  value: Date | string | number,
  formatStr: string = DEFAULT_DATE_FORMAT,
  options: DateFormatOptions = {}
): string {
  try {
    if (!value) {
      return '';
    }

    let dateValue: Date;
    
    if (typeof value === 'string') {
      dateValue = parseISO(value);
    } else if (typeof value === 'number') {
      dateValue = new Date(value);
    } else {
      dateValue = value;
    }

    if (!isValidDate(dateValue)) {
      return '';
    }

    // Apply timezone offset if specified
    if (options.timezone) {
      const tzOffset = new Date().getTimezoneOffset() * 60000;
      dateValue = new Date(dateValue.getTime() + tzOffset);
    }

    return format(dateValue, formatStr, {
      locale: options.locale || enUS
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Parses a date string into a Date object with timezone awareness.
 * 
 * @param dateString - ISO date string to parse
 * @param timezone - Optional timezone identifier
 * @returns Parsed Date object or null if invalid
 */
export function parseDate(dateString: string, timezone?: string): Date | null {
  try {
    if (!dateString) {
      return null;
    }

    const parsedDate = parseISO(dateString);
    
    if (!isValidDate(parsedDate)) {
      return null;
    }

    if (timezone) {
      // Adjust for timezone if specified
      const tzOffset = new Date().getTimezoneOffset() * 60000;
      return new Date(parsedDate.getTime() - tzOffset);
    }

    return parsedDate;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

/**
 * Calculates the relative time difference between two dates with localization support.
 * 
 * @param date - Target date for comparison
 * @param baseDate - Base date to compare against (defaults to current date)
 * @param options - Optional configuration for relative time formatting
 * @returns Human-readable relative time difference
 */
export function getRelativeTime(
  date: Date | string | number,
  baseDate: Date | string | number = new Date(),
  options: RelativeTimeOptions = {}
): string {
  try {
    const targetDate = typeof date === 'string' ? parseDate(date) : new Date(date);
    const compareDate = typeof baseDate === 'string' ? parseDate(baseDate) : new Date(baseDate);

    if (!targetDate || !compareDate || !isValidDate(targetDate) || !isValidDate(compareDate)) {
      return '';
    }

    return formatDistance(targetDate, compareDate, {
      locale: options.locale || enUS,
      addSuffix: options.addSuffix
    });
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return '';
  }
}

/**
 * Checks if a given value is a valid date with comprehensive validation.
 * 
 * @param value - Value to validate as date
 * @returns True if valid date, false otherwise
 */
export function isValidDate(value: any): boolean {
  if (!value) {
    return false;
  }

  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) && !isNaN(date.getTime());
}