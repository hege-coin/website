//
// COOKIE CONSENT
//

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

// Consent when user accepts all cookies (we only use analytics atm)
const ACCEPT_CONSENT = {
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied',
  'analytics_storage': 'granted',
};

// Consent when user rejects cookies, or has not yet made a choice
const REJECT_CONSENT = {
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied',
  'analytics_storage': 'denied',
};

const DEFAULT_CONSENT = REJECT_CONSENT

const DEBUG = false;
function debug_log() {
  DEBUG && console.log(arguments);
}

/** Returns user settings from storage, or null if not set. */
function loadConsentSettings(storage = localStorage) {
  consent = JSON.parse(storage.getItem('consent'));
  debug_log('Loaded consent...', consent);
  return consent;
}

/** Saves user settings to storage. */
function saveConsentSettings(consent, storage = localStorage) {
  debug_log('Saving consent...', consent);
  storage.setItem('consent', JSON.stringify(consent));
}

/** Sets consent with gtag. Op should be either 'default' or 'update'. */
function setConsent(consent, op) {
  debug_log('Setting consent with gtag...', consent, op);
  gtag('consent', op, consent);
  document.dispatchEvent(new CustomEvent("consentChanged", { detail: consent }));
}

// Set defaults based on user preference, before loading Google Analytics
gtag('consent', 'default', DEFAULT_CONSENT);

// Did user already make a selection in the past?
settings = loadConsentSettings();
if (settings) {
  // Yes: Set it accordingly
  debug_log('Cookie settings found:', settings);
  setConsent(settings, 'update');
}

document.addEventListener('DOMContentLoaded', function () {
  const dialog = document.getElementById('cookie-consent-dialog');
  if (!dialog) {
    console.error('Cookie consent dialog not found.');
    return false;
  }
  const accept_button = document.getElementById('accept-cookies-btn');
  const reject_button = document.getElementById('reject-cookies-btn');

  accept_button.addEventListener('click', function () {
    debug_log('Handling accept...')
    saveConsentSettings(ACCEPT_CONSENT);
    setConsent(ACCEPT_CONSENT, 'update');
  });
  reject_button.addEventListener('click', function () {
    debug_log('Handling reject...')
    saveConsentSettings(REJECT_CONSENT);
    setConsent(REJECT_CONSENT, 'update');
  });

  // Has user not yet made their selection? Show the banner if so.
  // Note that this can be disabled by setting data-disable_cookie_banner="false" on <body>
  if (!loadConsentSettings() && !document.body.dataset.disable_cookie_banner) {
    debug_log('User has not set cookie settings yet. Showing dialog...');
    dialog.show();
  }
});

//
// GEO-BLOCK
//

const BLOCKED_COUNTRIES = ['GB',];

async function isGeoBlocked() {
  const response = await fetch('https://get.geojs.io/v1/ip/country.json');
  if (!response.ok) {
    console.error('Geo-location check failed.');
    return false;
  }
  const data = await response.json();
  return BLOCKED_COUNTRIES.includes(data.country);
}

function triggerGeoBlock() {
  const template = document.getElementById('geoblock-msg-template');
  if (!template) {
    console.error('Template for geo-block message not found.');
    return false;
  }
  const clone = template.content.cloneNode(true);
  target = document.body;
  target.classList.add('geoblocked');
  target.innerHTML = '';
  target.appendChild(clone);
}

document.addEventListener('DOMContentLoaded', async function () {
  if (await isGeoBlocked()) {
    triggerGeoBlock();
  }
});


//
// UTILS
//

function scrollSlider(id, direction) {
  var e = document.getElementById(id);
  let w = e.firstElementChild.scrollWidth;
  e.scrollLeft += w * direction;
}

//
// TELEGRAM CHAT BOX
//

function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function createMessageElement(message) {
  // Only show text messages
  if (!message.text) {
    return false;
  }

  const msg_el = document.createElement('div');
  const avatar_el = document.createElement('div');
  const content_el = document.createElement('div');
  const header_el = document.createElement('div');
  const username_el = document.createElement('strong');
  const timestamp_el = document.createElement('date');
  const text_el = document.createElement('p');

  msg_el.id = 'message-' + message.messageId;

  if (message.profilePhotoUrl) {
    const img = document.createElement('img');
    img.src = 'https://stellar-rebirth-production.up.railway.app' + message.profilePhotoUrl;
    img.alt = 'pp';
    img.width = '50';
    img.height = '50';
    avatar_el.appendChild(img);
  } else {
    avatar_el.innerHTML = '<span>' + message.firstName.charAt(0).toUpperCase() + '</span>';
  }

  username_el.textContent = `${message.firstName} ${message.lastName || ''}`.trim();
  timestamp_el.textContent = formatDate(message.timestamp);
  text_el.textContent = message.text;

  header_el.appendChild(username_el);
  header_el.appendChild(timestamp_el);
  content_el.appendChild(header_el);
  content_el.appendChild(text_el);

  msg_el.appendChild(avatar_el);
  msg_el.appendChild(content_el);

  return msg_el;
}

async function loadMessages(msg_src, target_el, last_msg_id) {
  try {
    const threshold = 50;
    const should_scroll = target_el.scrollHeight - (target_el.scrollTop + target_el.clientHeight) <= threshold;

    messages = await msg_src(last_msg_id);
    messages.forEach(message => {
      if (!document.getElementById('message-' + message.messageId)) {
        let msg_el = createMessageElement(message);
        if (msg_el) {
          target_el.appendChild(msg_el);
          target_el.classList.add('filled');
          last_msg_id = Math.max(last_msg_id, message.messageId);
        }
      }
    });

    if (should_scroll) {
      target_el.scrollTo({
        top: target_el.scrollHeight,
        behavior: 'smooth'
      });
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  } finally {
    setTimeout(function () { loadMessages(msg_src, target_el, last_msg_id); }, 5000)
  }
}

async function getMessages(last_msg_id) {
  const API_URL = 'https://stellar-rebirth-production.up.railway.app/api/v1/messages';
  const url = new URL(API_URL);
  if (last_msg_id > 0) {
    url.searchParams.append('since', last_msg_id.toString());
  }
  const res = await fetch(url);
  const data = await res.json();
  return data.messages;
}

document.addEventListener('DOMContentLoaded', async function () {
  const target_el = document.getElementById('tg-live');
  if (target_el) {
    // loadMessages(getMessages, target_el, 0);
  }
});