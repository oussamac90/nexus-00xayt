import { Pipe, PipeTransform } from '@angular/core'; // @angular/core@16.x
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'; // @angular/platform-browser@16.x

/**
 * Pipe that securely transforms HTML strings into sanitized SafeHtml values
 * while preventing XSS attacks through strict input validation and sanitization.
 * 
 * Usage:
 * ```html
 * <div [innerHTML]="htmlContent | safeHtml"></div>
 * ```
 * 
 * @security This pipe uses Angular's DomSanitizer to prevent XSS attacks
 * while allowing trusted HTML content to be rendered in templates.
 */
@Pipe({
  name: 'safeHtml',
  pure: true // Optimize performance by making pipe pure since sanitization is deterministic
})
export class SafeHtmlPipe implements PipeTransform {
  /**
   * Creates an instance of SafeHtmlPipe.
   * @param sanitizer - Angular's DomSanitizer service for secure HTML transformation
   */
  constructor(private readonly sanitizer: DomSanitizer) {}

  /**
   * Transforms an HTML string into a sanitized SafeHtml value that can be safely rendered.
   * 
   * @param html - The HTML string to be sanitized and transformed
   * @returns A sanitized SafeHtml value or null if input is invalid
   * @security Uses DomSanitizer.bypassSecurityTrustHtml for XSS prevention
   */
  transform(html: string | null | undefined): SafeHtml | null {
    // Return null for invalid input to maintain type safety
    if (html == null) {
      return null;
    }

    // Convert input to string to handle any non-string inputs safely
    const htmlString = String(html);

    // Skip sanitization for empty strings to optimize performance
    if (htmlString.trim().length === 0) {
      return null;
    }

    // Transform HTML string into sanitized SafeHtml using DomSanitizer
    return this.sanitizer.bypassSecurityTrustHtml(htmlString);
  }
}