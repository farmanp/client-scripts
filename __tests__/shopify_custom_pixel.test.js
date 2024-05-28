// Mock global objects and methods
global.document = {
  createElement: jest.fn().mockReturnValue({
    src: '',
    appendChild: jest.fn()
  }),
  head: {
    appendChild: jest.fn()
  }
};

global.window = {
  fueled: {
    customPixel: {
      trackEvent: jest.fn()
    }
  },
  addEventListener: jest.fn()
};

// Mock the analytics object
global.analytics = {
  subscribe: jest.fn()
};

// Define constants for events
const TRACK_EVENTS = [
  'checkout_started',
  'checkout_contact_info_submitted',
  'checkout_address_info_submitted',
  'payment_info_submitted'
];

const GA4_EXCLUDED_EVENTS = ['checkout_started'];

// Import the code to be tested
const { loadScript, trackEvent, initializeTracking } = (() => {
  const SCRIPT_URL = `/apps/fueled/client.js?page=custom_pixel&rand=1`;

  function loadScript(src) {
    const script = document.createElement("script");
    script.src = src;
    document.head.appendChild(script);
  }

  function trackEvent(event, excludeFromGA4) {
    const options = excludeFromGA4 ? {
      plugins: {
        all: true,
        "google-analytics": false,
      }
    } : null;

    window.fueled.customPixel.trackEvent(event, options, initializeTracking);
  }

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

  initializeTracking({ trackEvents: TRACK_EVENTS, ga4ExcludedEvents: GA4_EXCLUDED_EVENTS });

  return { loadScript, trackEvent, initializeTracking };
})();

describe('loadScript', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create and append a script element', () => {
    loadScript('test-script.js');
    expect(document.createElement).toHaveBeenCalledWith('script');
    expect(document.head.appendChild).toHaveBeenCalled();
    expect(document.head.appendChild.mock.calls[0][0].src).toBe('test-script.js');
  });
});

describe('trackEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call fueled.customPixel.trackEvent with the correct parameters for excluded events', () => {
    const event = { name: 'checkout_started' };
    trackEvent(event, true);
    expect(window.fueled.customPixel.trackEvent).toHaveBeenCalledWith(event, {
      plugins: {
        all: true,
        "google-analytics": false,
      }
    }, expect.any(Function));
  });

  it('should call fueled.customPixel.trackEvent without options for non-excluded events', () => {
    const event = { name: 'checkout_contact_info_submitted' };
    trackEvent(event, false);
    expect(window.fueled.customPixel.trackEvent).toHaveBeenCalledWith(event, null, expect.any(Function));
  });
});

describe('initializeTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should subscribe to events and load the script', () => {
    const configs = {
      trackEvents: TRACK_EVENTS,
      ga4ExcludedEvents: GA4_EXCLUDED_EVENTS
    };

    // Mock analytics.subscribe to simulate event subscription
    global.analytics.subscribe.mockImplementation((eventName, callback) => {
      callback({ name: eventName });
    });

    initializeTracking(configs);

    // Verify that subscribe was called for each event
    TRACK_EVENTS.forEach(eventName => {
      expect(analytics.subscribe).toHaveBeenCalledWith(eventName, expect.any(Function));
    });

    // Verify that the script was created and appended
    expect(document.createElement).toHaveBeenCalledWith('script');
    expect(document.head.appendChild).toHaveBeenCalled();
  });

  it('should track events when fueled is ready', () => {
    const configs = {
      trackEvents: TRACK_EVENTS,
      ga4ExcludedEvents: GA4_EXCLUDED_EVENTS
    };

    // Mock analytics.subscribe to simulate event subscription
    global.analytics.subscribe.mockImplementation((eventName, callback) => {
      callback({ name: eventName });
    });

    initializeTracking(configs);

    // Simulate Fueled ready event
    const fueledReadyEvent = window.addEventListener.mock.calls.find(call => call[0] === 'fueled-shopify-ready')[1];
    fueledReadyEvent();

    expect(window.fueled.customPixel.trackEvent).toHaveBeenCalledWith({ name: 'checkout_started' }, {
      plugins: {
        all: true,
        "google-analytics": false,
      }
    }, expect.any(Function));
  });

  it('should buffer events until fueled is ready', () => {
    const configs = {
      trackEvents: TRACK_EVENTS,
      ga4ExcludedEvents: GA4_EXCLUDED_EVENTS
    };

    const bufferedEvent = { name: 'checkout_started' };

    // Mock analytics.subscribe to simulate event before script is loaded
    global.analytics.subscribe.mockImplementation((eventName, callback) => {
      callback(bufferedEvent);
    });

    initializeTracking(configs);

    expect(global.analytics.subscribe).toHaveBeenCalled();
    expect(window.fueled.customPixel.trackEvent).not.toHaveBeenCalled();

    // Simulate Fueled ready event
    const fueledReadyEvent = window.addEventListener.mock.calls.find(call => call[0] === 'fueled-shopify-ready')[1];
    fueledReadyEvent();

    expect(window.fueled.customPixel.trackEvent).toHaveBeenCalledWith(bufferedEvent, {
      plugins: {
        all: true,
        "google-analytics": false,
      }
    }, expect.any(Function));
  });

  it('should not track events before script is loaded', () => {
    const configs = {
      trackEvents: TRACK_EVENTS,
      ga4ExcludedEvents: GA4_EXCLUDED_EVENTS
    };

    const event = { name: 'checkout_contact_info_submitted' };

    // Mock analytics.subscribe to simulate event before script is loaded
    global.analytics.subscribe.mockImplementation((eventName, callback) => {
      callback(event);
    });

    initializeTracking(configs);

    expect(window.fueled.customPixel.trackEvent).not.toHaveBeenCalled();

    // Simulate Fueled ready event
    const fueledReadyEvent = window.addEventListener.mock.calls.find(call => call[0] === 'fueled-shopify-ready')[1];
    fueledReadyEvent();

    expect(window.fueled.customPixel.trackEvent).toHaveBeenCalledWith(event, null, expect.any(Function));
  });

  it('should not track events before fueled is ready', () => {
    const configs = {
      trackEvents: TRACK_EVENTS,
      ga4ExcludedEvents: GA4_EXCLUDED_EVENTS
    };

    const event = { name: 'checkout_contact_info_submitted' };

    // Mock analytics.subscribe to simulate event before Fueled is ready
    global.analytics.subscribe.mockImplementation((eventName, callback) => {
      callback(event);
    });

    initializeTracking(configs);

    expect(window.fueled.customPixel.trackEvent).not.toHaveBeenCalled();

    // Simulate Fueled ready event
    const fueledReadyEvent = window.addEventListener.mock.calls.find(call => call[0] === 'fueled-shopify-ready')[1];
    fueledReadyEvent();

    expect(window.fueled.customPixel.trackEvent).toHaveBeenCalledWith(event, null, expect.any(Function));
  });
});
