/**
 * Possible events:
 * product_added_to_cart, checkout_started, checkout_contact_info_submitted, checkout_address_info_submitted, payment_info_submitted
 *
 * Note: You might notice a warning message in Shopify's Custom Pixel UI suggesting that this script doesn't include any event subscriptions.
 * That is not an issue. It's just that our scripts use variables to generate subscription calls.
 *
 * You can learn more at: https://learn.fueled.io/apps/shopify/shopify-event-tracking/custom-pixel-for-tracking-checkout-steps.
 */
const SCRIPT_URL = `/apps/fueled/client.js?page=custom_pixel&rand=1`;

// Configuration for events and exclusions
const config = {
  trackEvents: [
    //'product_added_to_cart', /* Uncomment this event if you have disabled Fueled's standard "Add to Cart" tracking in our app configuration. */
    'checkout_started', // Fires "Initiate Checkout" event for Facebook Pixel/CAPI
    'checkout_contact_info_submitted', // Fires identify() event to improve match data
    'checkout_address_info_submitted', // Fires identify() event to improve match data
    'payment_info_submitted' // Fires "Add Payment Info" event into GA4 and FB
  ],
  ga4ExcludedEvents: ['checkout_started'] // Exclude from GA4 unless server-side tracking is disabled
};

/**
 * Load an external script dynamically.
 * @param {string} src - The source URL of the script to load.
 */
function loadScript(src) {
  const script = document.createElement("script");
  script.src = src;
  document.head.appendChild(script);
}

/**
 * Track an event using Fueled's customPixel.trackEvent method.
 * @param {Object} event - The event object to track.
 * @param {boolean} excludeFromGA4 - Flag to exclude the event from GA4 tracking.
 */
function trackEvent(event, excludeFromGA4) {
  const options = excludeFromGA4 ? {
    plugins: {
      all: true,
      "google-analytics": false
    }
  } : null;

  window.fueled.customPixel.trackEvent(event, options, initializeTracking);
}

/**
 * Initialize event tracking by subscribing to specified events and setting up the Fueled readiness listener.
 * @param {Object} configs - Configuration object containing trackEvents and ga4ExcludedEvents.
 */
function initializeTracking(configs) {
  const eventsBuffer = [];
  let scriptLoaded = false;
  let fueledReady = false;

  configs.trackEvents.forEach(eventName => {
    analytics.subscribe(eventName, event => {
      if (!scriptLoaded) {
        loadScript(SCRIPT_URL);
        scriptLoaded = true;
      }

      if (fueledReady) {
        trackEvent(event, configs.ga4ExcludedEvents.includes(event.name));
      } else {
        eventsBuffer.push(event);
      }
    });
  });

  window.addEventListener("fueled-shopify-ready", () => {
    if (!fueledReady) {
      fueledReady = true;
      eventsBuffer.forEach(event => trackEvent(event, configs.ga4ExcludedEvents.includes(event.name)));
    }
  });
}

// Initialize tracking with the given configuration
initializeTracking(config);
