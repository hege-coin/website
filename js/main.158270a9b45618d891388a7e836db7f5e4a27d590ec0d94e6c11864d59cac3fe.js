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

function toggleBuyDexCex(id, c) {
  var e = document.getElementById(id)
  if (!c) {
    c = e.className == 'dex' ? 'cex' : 'dex';
  }
  e.className = c;
  return false;
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

//
// NTF FLOOR PRICE
//

function setNftFloorPrice(target_el) {
  const me_url = 'https://api-mainnet.magiceden.dev/v2/collections/hegends/stats';
  const sol_url = 'https://api.diadata.org/v1/assetQuotation/Solana/0x0000000000000000000000000000000000000000';
  const cors_proxy = 'https://cors.io/?url='
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json'
    }
  };
  fetch(cors_proxy + encodeURIComponent(sol_url), options)
    .then(res => res.json())
    .then(data => {
      sol_d = JSON.parse(data.body);
      fetch(cors_proxy + encodeURIComponent(me_url), options)
        .then(res => res.json())
        .then(data => {
          me_d = JSON.parse(data.body);
          const usd_price = (sol_d.Price * me_d.floorPrice / 1000000000).toFixed(2);
          target_el.innerHTML = '$' + usd_price;
        })
        .catch(err => console.error(err));
    })
    .catch(err => console.error(err));
}

document.addEventListener('DOMContentLoaded', function () {
  const target = document.getElementById('hegends-floor-price');
  setNftFloorPrice(target);
});