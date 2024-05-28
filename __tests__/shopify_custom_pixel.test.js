// __tests__/eventTracking.test.js

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
  addEventListener: jest.fn((event, callback) => {
    if (event === 'fueled-shopify-ready') {
      callback();
    }
  })
};

// Mock the analytics object
global.analytics = {
  subscribe: jest.fn((eventName, callback) => {
    callback({ name: eventName });
  })
};

// Import the code to be tested
const { loadScript, trackEvent, initializeTracking } = (() => {
  // The actual code that needs testing
  const trackEvents = [
    'checkout_started',
    'checkout_contact_info_submitted',
    'checkout_address_info_submitted',
    'payment_info_submitted'
  ];

  const ga4ExcludedEvents = ['checkout_started'];

  function loadScript(src) {
    const script = document.createElement("script");
    script.src = src;
    document.head.appendChild(script);
  }

  function trackEvent(event) {
    const options = ga4ExcludedEvents.includes(event.name) ? {
      plugins: {
        all: true,
        "google-analytics": false,
      }
    } : null;

    window.fueled.customPixel.trackEvent(event, options, initializeTracking);
  }

  function initializeTracking(configs) {
    const events = [];
    let scriptLoaded = false;
    let fueledReady = false;

    configs.trackEvents.forEach(eventName => {
      analytics.subscribe(eventName, event => {
        if (!scriptLoaded) {
          loadScript(`/apps/fueled/client.js?page=custom_pixel&rand=1`);
          scriptLoaded = true;
        }

        if (fueledReady) {
          trackEvent(event);
        } else {
          events.push(event);
        }
      });
    });

    window.addEventListener("fueled-shopify-ready", () => {
      if (!fueledReady) {
        fueledReady = true;
        events.forEach(event => trackEvent(event));
      }
    });
  }

  initializeTracking({ trackEvents, ga4ExcludedEvents });

  return { loadScript, trackEvent, initializeTracking };
})();

describe('loadScript', () => {
  it('should create and append a script element', () => {
    loadScript('test-script.js');
    expect(document.createElement).toHaveBeenCalledWith('script');
    expect(document.head.appendChild).toHaveBeenCalled();
    expect(document.head.appendChild.mock.calls[0][0].src).toBe('test-script.js');
  });
});

describe('trackEvent', () => {
  it('should call fueled.customPixel.trackEvent with the correct parameters', () => {
    const event = { name: 'checkout_started' };
    trackEvent(event);
    expect(window.fueled.customPixel.trackEvent).toHaveBeenCalledWith(event, {
      plugins: {
        all: true,
        "google-analytics": false,
      }
    }, expect.any(Function));
  });

  it('should call fueled.customPixel.trackEvent without options for non-excluded events', () => {
    const event = { name: 'checkout_contact_info_submitted' };
    trackEvent(event);
    expect(window.fueled.customPixel.trackEvent).toHaveBeenCalledWith(event, null, expect.any(Function));
  });
});

describe('initializeTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should subscribe to events and load the script', () => {
    const configs = {
      trackEvents: ['checkout_started'],
      ga4ExcludedEvents: ['checkout_started']
    };

    initializeTracking(configs);

    expect(analytics.subscribe).toHaveBeenCalledWith('checkout_started', expect.any(Function));
    expect(document.createElement).toHaveBeenCalled();
    expect(document.head.appendChild).toHaveBeenCalled();
  });

  it('should track events when fueled is ready', () => {
    const configs = {
      trackEvents: ['checkout_started'],
      ga4ExcludedEvents: ['checkout_started']
    };

    initializeTracking(configs);

    expect(window.fueled.customPixel.trackEvent).toHaveBeenCalledWith({ name: 'checkout_started' }, {
      plugins: {
        all: true,
        "google-analytics": false,
      }
    }, expect.any(Function));
  });

  it('should buffer events until fueled is ready', () => {
    const configs = {
      trackEvents: ['checkout_started'],
      ga4ExcludedEvents: ['checkout_started']
    };

    const bufferedEvent = { name: 'checkout_started' };

    // Mock analytics.subscribe to simulate event before script is loaded
    global.analytics.subscribe.mockImplementation((eventName, callback) => {
      callback(bufferedEvent);
    });

    initializeTracking(configs);

    expect(global.analytics.subscribe).toHaveBeenCalled();
    expect(window.fueled.customPixel.trackEvent).toHaveBeenCalledWith(bufferedEvent, {
      plugins: {
        all: true,
        "google-analytics": false,
      }
    }, expect.any(Function));
  });
});
