// Simple SPA router and components

// API base builder: if `window.__API_BASE__` is set (dev or prod config), prefix paths with it.
function getApiUrl(path){
  const base = (typeof window !== 'undefined' && window.__API_BASE__) ? String(window.__API_BASE__).replace(/\/$/, '') : '';
  return base ? (base + path) : path;
}
const API = {
  albums: () => getApiUrl('/api/albums'),
  orders: () => getApiUrl('/api/orders'),
  // auth endpoints (kept as in current router mounting)
  authRegister: () => getApiUrl('/auth/auth/register'),
  authLogin: () => getApiUrl('/auth/auth/login')
};

function authToken() { return localStorage.getItem('token'); }
function setAuthToken(t) { if (t) localStorage.setItem('token', t); else localStorage.removeItem('token'); }
function isAuthenticated() { return !!authToken(); }

function authHeaders() {
  const t = authToken();
  return t ? { 'Authorization': 'Bearer ' + t } : {};
}

// Cart management
const CART_KEY = 'cart:v1';
function loadCart() { 
  try { 
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); 
  } catch { 
   return []; 
  } 
}

function saveCart(cart){ 
  localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartCount();
}

function addToCart(idOrObj, name, title, price) {
  let id, itemName, itemTitle, itemPrice;
  if (idOrObj && typeof idOrObj === 'object') {
    id = idOrObj.id;
    itemName = idOrObj.name || idOrObj.title;
    itemTitle = idOrObj.title;
    itemPrice = idOrObj.price;
  } else {
    id = idOrObj;
    itemName = name || title;
    itemTitle = title;
    itemPrice = price;
  }
  const cart = loadCart();
  const found = cart.find(c => c.id === id);
  if (found) {
    found.quantity = (found.quantity || 1) + 1;
  } else {
    cart.push({ id, name: itemName, title: itemTitle, price: itemPrice, quantity: 1 });
  }
  saveCart(cart);
}

function clearCart() { 
  localStorage.removeItem(CART_KEY);
  updateCartCount(); 
}

function updateCartCount(){
   const n = loadCart().reduce((s,i)=>s+(i.quantity||1),0); 
   const el = document.getElementById('cartCount'); 
   if(el) el.textContent = n; 
}

// Simple render helpers
function el(tag, attrs, ...children){ 
  const e = document.createElement(tag); 
  if(attrs) Object.entries(attrs).forEach(([k,v]) => { 
    if(k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k,v);
  }); 
  children.flat().forEach(c=>{ 
    if(c==null) return; 
    if(typeof c==='string') e.appendChild(document.createTextNode(c)); 
    else e.appendChild(c); }); 
    return e; 
  }

// Views
async function renderCatalog(params={}){
  const view = document.getElementById('view'); view.innerHTML='';
  const container = el('div');
  const controls = el('div', {},
    el('input',{id:'search',placeholder:'Buscar...'}), ' ',
    el('button',{id:'btnSearch', onClick:async ()=>{ await loadAlbums({ search: document.getElementById('search').value }); }}, 'Buscar')
  );
  container.appendChild(controls);
  const list = el('ul',{id:'albumsList'});
  container.appendChild(list);
  view.appendChild(container);
  updateCartCount();
  await loadAlbums(params);
}

// Loading overlay and toast helpers
function ensureLoadingOverlay(){
  if(document.getElementById('loadingOverlay')) return;
  const o = document.createElement('div');
  o.id = 'loadingOverlay';
  o.style.position = 'fixed';
  o.style.left = '0'; o.style.top = '0'; o.style.right = '0'; o.style.bottom = '0';
  o.style.display = 'none'; o.style.alignItems = 'center'; o.style.justifyContent = 'center';
  o.style.background = 'rgba(0,0,0,0.3)'; o.style.zIndex = '9999';
  const box = document.createElement('div');
  box.style.padding = '12px 18px'; box.style.background = '#fff'; box.style.borderRadius = '6px';
  box.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'; box.id = 'loadingBox';
  box.textContent = 'Cargando...';
  o.appendChild(box);
  document.body.appendChild(o);
}
function showLoading(msg){ ensureLoadingOverlay(); const o = document.getElementById('loadingOverlay'); if(!o) return; const box = document.getElementById('loadingBox'); if(box && msg) box.textContent = msg; o.style.display = 'flex'; }
function hideLoading(){ const o = document.getElementById('loadingOverlay'); if(o) o.style.display = 'none'; }

function showToast(message, opts={type:'error', timeout:4000}){
  const containerId = 'toastContainer';
  let c = document.getElementById(containerId);
  if(!c){ c = document.createElement('div'); c.id = containerId; c.style.position='fixed'; c.style.right='12px'; c.style.top='12px'; c.style.zIndex='10000'; document.body.appendChild(c); }
  const t = document.createElement('div'); t.textContent = message; t.style.margin='6px'; t.style.padding='8px 12px'; t.style.borderRadius='6px'; t.style.minWidth='160px';
  t.style.color = opts.type==='error' ? '#fff' : '#000';
  t.style.background = opts.type==='error' ? '#e74c3c' : '#2ecc71';
  c.appendChild(t);
  setTimeout(()=>{ t.remove(); if(c.children.length===0) c.remove(); }, opts.timeout||3000);
}

// fetch wrapper that shows global loading and returns parsed JSON or throws
async function fetchWithFeedback(url, options={}, {showGlobal=true}={}){
  try{
    if(showGlobal) showLoading();
    const res = await fetch(url, options);
    let payload;
    try{ payload = await res.json(); }catch(e){ payload = null; }
    if(!res.ok){
      const msg = payload?.data?.message || payload?.message || `${res.status} ${res.statusText}`;
      const err = new Error(msg);
      err.status = res.status; err.payload = payload;
      throw err;
    }
    return payload;
  }finally{ if(showGlobal) hideLoading(); }
}

async function loadAlbums(query={}){
  const q = new URLSearchParams(query).toString();
  try{
    const payload = await fetchWithFeedback(API.albums() + (q?('?'+q):''), {}, {showGlobal:true});
    var items = Array.isArray(payload) ? payload : (payload.data && payload.data.items) ? payload.data.items : [];
  }catch(err){
    const listEl = document.getElementById('albumsList');
    listEl.innerHTML = '<li>Error cargando catálogo: ' + (err.message || '') + ' <button id="retryAlbums">Reintentar</button></li>';
    const btn = document.getElementById('retryAlbums'); if(btn) btn.addEventListener('click', ()=> loadAlbums(query));
    return;
  }
  const list = document.getElementById('albumsList'); list.innerHTML = '';
  items.forEach(it=>{
    const li = el('li', {},
      el('strong',{}, it.name || it.title || ('Álbum ' + (it.id||''))),
      el('br'),
      (it.price?('$'+it.price):''), ' ',
      el('button',{onClick:()=>addToCart({id:it.id, name: it.name||it.title, price: it.price||0})}, 'Agregar')
    );
    list.appendChild(li);
  });
}

function renderLogin(){
  const view = document.getElementById('view'); view.innerHTML = '';
  const form = el('form', {},
    el('h2',{}, 'Iniciar Sesión'),
    el('input',{id:'email',placeholder:'Email', type:'email'}), el('br'),
    el('input',{id:'password',placeholder:'Password', type:'password'}), el('br'),
    el('button',{type:'submit'}, 'Entrar'), ' ', el('button',{type:'button', onClick:()=>renderRegister()}, 'Registrar') ,
    el('div',{id:'loginMsg'})
  );
  form.addEventListener('submit', async (e)=>{ e.preventDefault(); const email=form.querySelector('#email').value; 
    const pass=form.querySelector('#password').value; 
    try{ 
      const j = await fetchWithFeedback(API.authLogin(), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password: pass }) }, {showGlobal:true});
      if(j && j.data && j.data.token){
        setAuthToken(j.data.token); document.getElementById('navAuth').textContent = 'Cerrar sesión'; document.getElementById('navOrders').style.display='inline'; location.hash = '#/catalog';
      } else {
        form.querySelector('#loginMsg').textContent = j.data?.message || j.message || 'Error';
      }
    }catch(err){ 
        form.querySelector('#loginMsg').textContent = err.message; 
    } 
});
  view.appendChild(form);
}

function renderRegister(){
  const view = document.getElementById('view'); view.innerHTML = '';
  const form = el('form', {},
    el('h2',{}, 'Registro'),
    el('input',{id:'nombre',placeholder:'Nombre Completo'}), el('br'),
    el('input',{id:'email',placeholder:'Email', type:'email'}), el('br'),
    el('input',{id:'password',placeholder:'Password', type:'password'}), el('br'),
    el('button',{type:'submit'}, 'Registrar'), el('div',{id:'regMsg'})
  );
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const nombre=form.querySelector('#nombre').value; const email=form.querySelector('#email').value; const pass=form.querySelector('#password').value;
    try{
      const j = await fetchWithFeedback(API.authRegister(), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ nombreCompleto: nombre, email, password: pass }) }, {showGlobal:true});
      // on success, redirect to login
      location.hash = '#/login';
    }catch(err){ form.querySelector('#regMsg').textContent = err.message; }
  });
  view.appendChild(form);
}

function renderCart(){
  const view = document.getElementById('view'); view.innerHTML = '';
  const cart = loadCart();
  const list = el('ul',{}, ...cart.map(i=> el('li',{}, `${i.name} x ${i.quantity} - $${i.price||0} `, el('button',{onClick:()=>{ const c = loadCart(); 
    const idx=c.findIndex(x=>x.id===i.id); if(idx>=0){ c.splice(idx,1); saveCart(c); 
      renderCart(); } }}, 'Eliminar'))));
  const total = cart.reduce((s,i)=>s + (i.price||0)*(i.quantity||1),0);
  const footer = el('div',{}, el('strong',{}, 'Total: $' + total), ' ', el('button',{onClick:()=>{ 
    if(!isAuthenticated()){ 
      location.hash='#/login'; 
      return; 
    } location.hash='#/checkout'; 
  }}, 'Checkout'));
  view.appendChild(el('h2',{}, 'Carrito')); 
  view.appendChild(list); view.appendChild(footer);
}

function renderCheckout(){
  if(!isAuthenticated()){ 
    location.hash = '#/login'; 
    return; 
  }
  const view = document.getElementById('view'); view.innerHTML = '';
  const cart = loadCart(); 
  if(cart.length===0){ 
    view.appendChild(el('p',{}, 'Carrito vacío'));
    return; 
   }
  const total = cart.reduce((s,i)=>s + (i.price||0)*(i.quantity||1),0);
  const form = el('form', {},
    el('h2',{}, 'Checkout'),
    el('p',{}, `Total a pagar: $${total}`),
    el('input',{id:'card',placeholder:'Número tarjeta (simulado)'}), el('br'),
    el('input',{id:'cvv',placeholder:'CVV'}), el('br'),
    el('input',{id:'expMonth',placeholder:'Mes Expiración'}), el('br'),
    el('input',{id:'expYear',placeholder:'Año Expiración'}), el('br'),
    el('input',{id:'fullName',placeholder:'Nombre Completo en Tarjeta'}), el('br'),
    el('button',{type:'submit'}, 'Pagar'), el('div',{id:'payMsg'})
  );
  form.addEventListener('submit', async (e)=>{ e.preventDefault(); 
    const paymentDetails = {
      cardNumber: form.querySelector('#card').value, 
      cvv: form.querySelector('#cvv').value,
      expMonth: form.querySelector('#expMonth').value,
      expYear: form.querySelector('#expYear').value,
      fullName: form.querySelector('#fullName').value

    };

    const body = { 
      items: cart.map(i=>({ albumId: i.id, quantity: i.quantity })), 
      paymentMethod: 'creditcard',  paymentDetails 
    };

      try{
        const j = await fetchWithFeedback(API.orders(), { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, authHeaders()), body: JSON.stringify(body) }, {showGlobal:true});
        clearCart();
        form.querySelector('#payMsg').textContent = 'Pago exitoso. Orden creada.';
        location.hash='#/orders';
      }catch(err){
        form.querySelector('#payMsg').textContent = err.message || 'Error en pago';
      }
    });
  view.appendChild(form);
}

async function renderOrders(){
  if(!isAuthenticated()){ location.hash = '#/login'; return; }
  const view = document.getElementById('view'); view.innerHTML = '';
  view.appendChild(el('h2',{}, 'Mis Pedidos'));
  try{
    const j = await fetchWithFeedback(API.orders(), { headers: authHeaders() }, {showGlobal:true});
    // Normalizar distintos formatos de respuesta:
    // - Array directo
    // - { data: { orders: [...] } }
    // - { data: { items: [...] } }
    // - { data: [...] }
    let items = [];
    if (Array.isArray(j)) items = j;
    else if (j && j.data) {
      if (Array.isArray(j.data)) items = j.data;
      else if (Array.isArray(j.data.orders)) items = j.data.orders;
      else if (Array.isArray(j.data.items)) items = j.data.items;
      else items = [];
    }
    if (!items || items.length === 0) {
      view.appendChild(el('p',{}, 'No hay pedidos')); return;
    }
    const list = el('ul',{}, ...items.map(o=> el('li',{}, `#${o.id} - ${o.status || ''} - Total: $${o.totalAmount || o.total || 'N/A'}`)));
    view.appendChild(list);
  }catch(err){ view.appendChild(el('p',{}, err.message)); }
}

// Router
function route(){ const hash = location.hash || '#/catalog'; const path = hash.replace('#',''); 
  if(path.startsWith('/catalog')) renderCatalog(); 
  else if(path.startsWith('/cart')) renderCart(); 
  else if(path.startsWith('/login')) renderLogin(); 
  else if(path.startsWith('/register')) renderRegister(); 
  else if(path.startsWith('/checkout')) renderCheckout(); 
  else if(path.startsWith('/orders')) renderOrders(); 
  else renderCatalog(); }

window.addEventListener('hashchange', route);
window.addEventListener('load', ()=>{ // init nav
  document.getElementById('navAuth').addEventListener('click', (e)=>{ e.preventDefault(); 
    if(isAuthenticated()){ 
      setAuthToken(null); document.getElementById('navAuth').textContent='Iniciar Sesión'; 
      location.hash='#/catalog'; 
    } else { 
      location.hash='#/login'; 
    } 
  });
  updateCartCount(); 
  if(isAuthenticated()){
   document.getElementById('navAuth').textContent='Cerrar sesión'; 
  }else{ 
    document.getElementById('navAuth').textContent='Iniciar Sesión'; 
  } 
  if(!isAuthenticated()) document.getElementById('navOrders').style.display='none';
  route();
});
