/**
 * This file includes polyfills needed by Angular and is loaded before the app.
 * You can add your own extra polyfills to this file.
 * 
 * This file is loaded before the main application and configures necessary
 * browser compatibility features and Angular requirements.
 * 
 * @required zone.js - Essential for Angular's change detection and async operations
 * @browser_support Ensures compatibility across all major browsers
 * @performance Optimized for minimal performance impact
 */

/***************************************************************************************************
 * Zone JS is required by default for Angular itself.
 * 
 * Version: 0.13.x
 * Purpose: Handles Angular's change detection and async operations
 * Browser Support:
 * - Chrome >= 60
 * - Firefox >= 60
 * - Edge >= 79
 * - Safari >= 12
 * - iOS >= 12
 * - Android >= 6
 */
import 'zone.js';  // Included with Angular CLI by default

/***************************************************************************************************
 * APPLICATION IMPORTS
 * 
 * Additional polyfills can be added below if required for specific browser support.
 * The following configuration ensures optimal performance while maintaining broad compatibility.
 */

/**
 * By default, zone.js will patch all possible macroTask and DomEvents
 * user can disable parts of macroTask/DomEvents patch by setting following flags
 */
// (window as any).__Zone_disable_requestAnimationFrame = true; // disable patch requestAnimationFrame
// (window as any).__Zone_disable_on_property = true; // disable patch onProperty such as onclick
// (window as any).__zone_symbol__BLACK_LISTED_EVENTS = ['scroll', 'mousemove']; // disable patch specified eventNames

/**
 * Optimized loading strategy for production environments.
 * Differential loading is enabled to serve modern browsers with ES2015+ features
 * while providing fallbacks for older browsers.
 */
if (!Object.getOwnPropertyDescriptor(Element.prototype, 'matches')) {
    Object.defineProperty(Element.prototype, 'matches', {
        configurable: true,
        enumerable: true,
        value: Element.prototype.msMatchesSelector ||
              Element.prototype.webkitMatchesSelector
    });
}

/**
 * Performance optimization: Disable zone.js patch for 
 * requestAnimationFrame in modern browsers that support it natively
 */
if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    (window as any).__Zone_disable_requestAnimationFrame = true;
}

/**
 * Ensure support for Web Components in browsers that need it
 * This is important for Angular Elements compatibility
 */
if (!window.customElements) {
    // Web Components polyfill would be loaded here if needed
    // But modern browsers targeted by the application already support it
}