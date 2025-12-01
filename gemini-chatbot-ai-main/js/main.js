//.main.js
const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".message-input");
const sendMessageButton = document.querySelector("#send-message");
const fileInput = document.querySelector("#file-input");
const fileUploadWrapper = document.querySelector(".file-upload-wrapper");
const fileCancelButton = document.querySelector("#file-cancel");
const chatbotToggler = document.querySelector("#chatbot-toggler");
const CloseChatbot = document.querySelector("#close-chatbot");


// API Setup
// API Configuración
const API_KEY = "AIzaSyBVb6xBSH4bptlPI-4xfE5lboKlCBTgM7I";
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

const userData = {
    message: null,
    file: {
        data: null,
        mime_type: null
    }
};

let chatHistory = [];
const STORAGE_KEY = 'chatbot_messages_v1';
const initialInputHeight = messageInput.scrollHeight;
// Estado temporal cuando se solicita al usuario cuántas unidades desea agregar
let pendingAdd = null;
// Paginación de productos (3 por página)
const PRODUCTS_PAGE_SIZE = 3;
const productPaginationStore = {}; // { storeId: { items: [...], currentPage: 1, totalPages: N } }

function generateStoreId() {
    return 'pps_' + Date.now().toString(36) + '_' + Math.floor(Math.random()*10000).toString(36);
}

function renderProductsPaginatedHTML(totalCount, storeId) {
    return `
        <div class="product-list-header">🔍 <strong>${totalCount} producto${totalCount === 1 ? '' : 's'} encontrado${totalCount === 1 ? '' : 's'}</strong></div>
        <div class="product-grid-paginated" data-store-id="${storeId}" data-page="1"></div>
        <div class="product-pager">
            <button type="button" class="prod-prev" data-store-id="${storeId}" disabled>Anterior</button>
            <span class="prod-page-info" data-store-id="${storeId}">1/1</span>
            <button type="button" class="prod-next" data-store-id="${storeId}">Siguiente</button>
        </div>
    `;
}

function renderProductPage(storeId, page) {
    const store = productPaginationStore[storeId];
    if (!store) return;
    const items = store.items || [];
    const pageSize = PRODUCTS_PAGE_SIZE;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const current = Math.min(Math.max(1, page || 1), totalPages);
    store.currentPage = current;
    store.totalPages = totalPages;

    const start = (current - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);
    const baseImg = 'https://backend-proyecto-distribuidora-production.up.railway.app/images/productos/';

    const cards = slice.map(p => {
        const encoded = encodeURIComponent((p.nombre||p.name||'').trim());
        const img = `${baseImg}${encoded}.jpg`;
        const displayPrice = String(p.precio||p.price||'0').replace(/\./g, ',');
        const viewUrl = `https://willy-vilca.github.io/FrontEnd-Proyecto-Distribuidora/producto-info.html?name=${encoded}`;
        const pname = escapeHtml(p.nombre || p.name || '');
        const pprice = escapeHtml(displayPrice);
        const pid = escapeHtml(String(p.id || p.id_producto || ''));
        const pdesc = escapeHtml(p.descripcion || p.desc || '');
        const pstock = escapeHtml(String(typeof p.stock !== 'undefined' ? p.stock : ''));
        return `
            <div class="product-card">
                <div class="product-media"><img src="${img}" alt="${pname}" onerror="this.src='${baseImg}default.jpg'"/></div>
                <div class="product-body">
                  <div class="product-meta">
                      <div class="product-name clamp-2">${pname}</div>
                      <button type="button" class="product-more" aria-expanded="false">Ver más</button>
                      <div class="product-price">S/ ${pprice}</div>
                  </div>
                  <div class="product-actions">
                      <button type="button" class="product-view" data-id="${pid}" data-name="${pname}" data-price="${pprice}" data-desc="${pdesc}" data-stock="${pstock}" data-view-url="${viewUrl}">Ver</button>
                      <button class="product-add" data-name="${pname}" data-price="${pprice}">Agregar</button>
                  </div>
                </div>
            </div>`;
    }).join('');

    const container = document.querySelector(`.product-grid-paginated[data-store-id="${storeId}"]`);
    const pageInfo = document.querySelector(`.prod-page-info[data-store-id="${storeId}"]`);
    const prevBtn = document.querySelector(`.prod-prev[data-store-id="${storeId}"]`);
    const nextBtn = document.querySelector(`.prod-next[data-store-id="${storeId}"]`);

    if (container) container.innerHTML = `<div class="product-grid">${cards}</div>`;
    if (pageInfo) pageInfo.textContent = `${current}/${totalPages}`;
    if (prevBtn) prevBtn.disabled = current <= 1;
    if (nextBtn) nextBtn.disabled = current >= totalPages;

    // Attach listeners to cards inside this container
    if (container) {
        try { attachProductCardListeners(container); } catch (err) { console.warn('attachProductCardListeners error', err); }
    }
}

function initializePaginationIn(root=document) {
    // Initialize any paginated product placeholders in the given root
    root.querySelectorAll('.product-grid-paginated').forEach(container => {
        const storeId = container.getAttribute('data-store-id');
        if (!storeId) return;
        const store = productPaginationStore[storeId];
        if (!store) return;
        // render first page
        renderProductPage(storeId, 1);
    });

    // pager buttons
    root.querySelectorAll('.prod-prev, .prod-next').forEach(btn => {
        if (btn.dataset.boundPager) return;
        btn.dataset.boundPager = '1';
        btn.addEventListener('click', (e) => {
            const storeId = btn.getAttribute('data-store-id');
            if (!storeId) return;
            const store = productPaginationStore[storeId];
            if (!store) return;
            const dir = btn.classList.contains('prod-next') ? 1 : -1;
            const nextPage = Math.min(Math.max(1, (store.currentPage||1) + dir), store.totalPages||1);
            renderProductPage(storeId, nextPage);
        });
    });
}

// ---------- Carrito mostrado por el chatbot (solo lectura/modificable local en el chat) ----------
// Persistencia del carrito del chat entre páginas
const CHAT_CART_KEY = 'chatbot_chat_cart_v1';
const chatCartStore = {}; // storeId -> [{id,nombre,precio,cantidad,stock}]

function saveChatCartToStorage(storeId){
    try{
        const items = (chatCartStore[storeId] || []).map(p=>({ id: p.id || null, nombre: p.nombre || '', precio: Number(p.precio||0), cantidad: Number(p.cantidad||1), stock: p.stock || null }));
        localStorage.setItem(CHAT_CART_KEY, JSON.stringify({ storeId, items }));
    }catch(e){ console.warn('saveChatCartToStorage error', e); }
}

function loadChatCartFromStorage(){
    try{
        const raw = localStorage.getItem(CHAT_CART_KEY);
        if(!raw) return null;
        const parsed = JSON.parse(raw);
        if(parsed && parsed.storeId && Array.isArray(parsed.items)) return parsed;
    }catch(e){ console.warn('loadChatCartFromStorage error', e); }
    return null;
}

// Cargar carrito persistido (si existe) en la estructura en memoria
(function initChatCartFromStorage(){
    try{
        const saved = loadChatCartFromStorage();
        if(saved){
            chatCartStore[saved.storeId] = saved.items;
            // Exponer storeId por si otras partes quieren conocerlo
            window.__chatbot_chat_store_id = saved.storeId;
        }
    }catch(e){ console.warn('initChatCartFromStorage error', e); }
})();

// Synchronization helpers
let _lastSiteCartHash = null;
let _syncingFromChat = false;

function hashCartData(arr){
    try{ return JSON.stringify(arr.map(i=>({id:i.id,nombre:i.nombre,precio:Number(i.precio||0),cantidad:Number(i.cantidad||0)}))); }catch(e){ return '' }
}

function syncChatToSite(storeId){
    try{
        const items = (chatCartStore[storeId]||[]).map(p=>({ id: p.id || null, nombre: p.nombre || '', precio: Number(p.precio||0), cantidad: Number(p.cantidad||1), stock: p.stock || null }));
        _syncingFromChat = true;
        if (typeof saveCarrito === 'function'){
            saveCarrito(items);
        } else {
            localStorage.setItem('carrito', JSON.stringify(items));
        }
        _lastSiteCartHash = hashCartData(items);
        // Persistir copia del carrito del chat para mantenerlo entre páginas
        try{ saveChatCartToStorage(storeId); }catch(e){}
        // release flag after short delay to avoid race
        setTimeout(()=>{ _syncingFromChat = false; }, 250);
    }catch(e){ console.warn('syncChatToSite error', e); _syncingFromChat = false; }
}

function updateChatFromSite(){
    try{
        const siteCart = (typeof getCarrito === 'function') ? getCarrito() : JSON.parse(localStorage.getItem('carrito')||'[]');
        const h = hashCartData(siteCart);
        if (h === _lastSiteCartHash) return; // no cambios
        if (_syncingFromChat) { _lastSiteCartHash = h; return; }
        _lastSiteCartHash = h;
        // update all open chat cart stores
        Object.keys(chatCartStore).forEach(storeId => {
            // merge by id (if id present) otherwise by nombre
            const updated = (siteCart||[]).map(p=>({ id: p.id||null, nombre: p.nombre, precio: p.precio, cantidad: p.cantidad, stock: p.stock||null }));
            chatCartStore[storeId] = updated;
            try{ saveChatCartToStorage(storeId); }catch(e){}
            try{ renderChatCartItems(storeId); updateChatCartTotals(storeId); }catch(e){}
        });
    }catch(e){ console.warn('updateChatFromSite error', e); }
}

// Poller to detect site cart changes (since storage events don't fire in same window)
setInterval(()=>{ updateChatFromSite(); }, 900);

function getSiteCartCopy(){
        try{
                if (typeof getCarrito === 'function') {
                        // deep copy
                        return JSON.parse(JSON.stringify(getCarrito()));
                }
                const raw = localStorage.getItem('carrito');
                return raw ? JSON.parse(raw) : [];
        }catch(e){ return []; }
}

function renderChatCartItems(storeId){
    const container = document.querySelector(`.chat-cart-items[data-store-id="${storeId}"]`);
    if (!container) return;

    const items = chatCartStore[storeId] || [];
    if (!items || items.length === 0) {
        container.innerHTML = `<div class="chat-cart-empty">Tu carrito está vacío</div>`;
        const footer = document.querySelector(`.chat-cart-footer[data-store-id="${storeId}"]`);
        if (footer) footer.style.display = 'none';
        return;
    }

        const baseImg = 'https://backend-proyecto-distribuidora-production.up.railway.app/images/productos/';
        const rows = items.map((p, idx)=>{
                const name = p.nombre || p.name || '';
                const encoded = encodeURIComponent((name||'').trim());
                const img = `${baseImg}${encoded}.jpg`;
                const precioNum = Number(p.precio||p.price||0);
                const precio = precioNum.toFixed(2);
                const subtotal = (precioNum * Number(p.cantidad||1)).toFixed(2);
                const displayName = escapeHtml(name);
                return `
                    <div class="chat-cart-item" data-store-id="${storeId}" data-idx="${idx}">
                        <img src="${img}" alt="${displayName}" onerror="this.src='${baseImg}default.jpg'" />
                        <div class="chat-cart-item-body">
                            <div class="chat-cart-name">${displayName}</div>
                            <div class="chat-cart-price">S/ ${precio}</div>
                            <div class="chat-cart-qty">
                                <button class="chatcart-decrease" aria-label="disminuir">-</button>
                                <input class="chatcart-qty-input" type="number" min="1" value="${p.cantidad||1}" />
                                <button class="chatcart-increase" aria-label="aumentar">+</button>
                            </div>
                        </div>
                        <div class="chat-cart-item-actions">
                            <div class="chat-cart-sub">S/ ${subtotal}</div>
                            <button class="chatcart-remove" title="Eliminar">✕</button>
                        </div>
                    </div>`;
        }).join('');

        container.innerHTML = rows;
        const footer = document.querySelector(`.chat-cart-footer[data-store-id="${storeId}"]`);
        if (footer) footer.style.display = items.length ? 'flex' : 'none';
}

function showChatCart(){
    const siteCart = getSiteCartCopy();
    const persisted = loadChatCartFromStorage();
    let storeId = persisted && persisted.storeId ? persisted.storeId : null;

    // Helper to normalize arrays into the internal shape
    const normalize = (arr) => (arr||[]).map(p=>({ id: p.id||null, nombre: p.nombre||p.name||'', precio: Number(p.precio||p.price||0), cantidad: Number(p.cantidad||p.qty||1), stock: p.stock||null }));

    // Ensure we have a storeId
    if (!storeId) {
        storeId = generateStoreId();
        window.__chatbot_chat_store_id = storeId;
    }

    // Prefer site cart when present (single source of truth) to avoid double-counting
    if (Array.isArray(siteCart) && siteCart.length > 0) {
        chatCartStore[storeId] = normalize(siteCart);
    } else if (persisted && Array.isArray(persisted.items) && persisted.items.length > 0) {
        chatCartStore[storeId] = normalize(persisted.items);
    } else {
        chatCartStore[storeId] = [];
    }

    // Remove any previous chat-cart DOM nodes to avoid duplicates/confusión
    try{ document.querySelectorAll('.chat-cart').forEach(n => n.remove()); }catch(e){}

    // Keep only the current store in memory to avoid stale data and double-counting
    try{ Object.keys(chatCartStore).forEach(k => { if (k !== storeId) delete chatCartStore[k]; }); }catch(e){}

    // Persist the chosen state
    try{ saveChatCartToStorage(storeId); }catch(e){}

    const totalCount = (chatCartStore[storeId]||[]).reduce((s,i)=>s + Number(i.cantidad||1),0);
    const totalPrice = (chatCartStore[storeId]||[]).reduce((s,i)=>s + (Number(i.precio||0) * Number(i.cantidad||1)),0).toFixed(2);

    const cartHtml = `
        <div class="chat-cart" data-store-id="${storeId}">
            <div class="chat-cart-header">🧾 <strong>Tu carrito</strong> — ${totalCount} unidades</div>
            <div class="chat-cart-items" data-store-id="${storeId}">
                <!-- items -->
            </div>
            <div class="chat-cart-footer" data-store-id="${storeId}">
                <div class="chat-cart-total">Total: S/ <span class="chat-cart-total-val">${totalPrice}</span></div>
                <div class="chat-cart-actions">
                    <button class="chatcart-view">Ver carrito</button>
                    <button class="chatcart-checkout">Finalizar pago</button>
                </div>
            </div>
        </div>`;

    const el = createMessageElement(cartHtml, 'bot-message');
    chatBody.appendChild(el);
    scrollToLatestMessage();
    renderChatCartItems(storeId);

    try{ updateChatCartTotals(storeId); }catch(e){}

    // set last site cart hash to avoid immediate overwrite
    try{ _lastSiteCartHash = hashCartData(getSiteCartCopy()); }catch(e){}

    // Hook into render/update flow: keep syncing after user actions
    const origRender = renderChatCartItems;
    renderChatCartItems = function(sid){
        try{ origRender(sid); }catch(e){}
        try{ updateChatCartTotals(sid); }catch(e){}
        try{ syncChatToSite(sid); }catch(e){}
    };

        // Delegate events inside this message
        const msgContainer = el;
        msgContainer.addEventListener('click', (ev)=>{
                const btn = ev.target.closest('button');
                if (!btn) return;
                const itemRow = ev.target.closest('.chat-cart-item');
                const idx = itemRow ? Number(itemRow.getAttribute('data-idx')) : null;
                if (btn.classList.contains('chatcart-remove') && idx !== null){
                        chatCartStore[storeId].splice(idx,1);
                        renderChatCartItems(storeId);
                        updateChatCartTotals(storeId);
                        return;
                }
                if (btn.classList.contains('chatcart-increase') && idx !== null){
                        const it = chatCartStore[storeId][idx];
                        if (it) { it.cantidad = Math.min(it.stock || Infinity, (Number(it.cantidad||1) + 1)); renderChatCartItems(storeId); updateChatCartTotals(storeId); }
                        return;
                }
                if (btn.classList.contains('chatcart-decrease') && idx !== null){
                        const it = chatCartStore[storeId][idx];
                        if (it) { it.cantidad = Math.max(1, Number(it.cantidad||1) - 1); renderChatCartItems(storeId); updateChatCartTotals(storeId); }
                        return;
                }
                if (btn.classList.contains('chatcart-view')){
                        // try to open main cart modal or call renderCarrito
                        try{ if (typeof renderCarrito === 'function') renderCarrito(); }catch(e){}
                        const trigger = document.querySelector('[data-bs-target="#cartModal"]');
                        if (trigger) trigger.click();
                        return;
                }
                if (btn.classList.contains('chatcart-checkout')){
                        window.location.href = 'finalizarPedido.html';
                        return;
                }
        });

        // quantity direct editing (input change)
        msgContainer.addEventListener('change', (ev)=>{
                const input = ev.target.closest('.chatcart-qty-input');
                if (!input) return;
                const row = input.closest('.chat-cart-item');
                if (!row) return;
                const idx = Number(row.getAttribute('data-idx'));
                const v = Math.max(1, Number(input.value) || 1);
                if (typeof chatCartStore[storeId][idx] !== 'undefined'){
                        chatCartStore[storeId][idx].cantidad = v;
                        renderChatCartItems(storeId);
                        updateChatCartTotals(storeId);
                }
        });

}

function updateChatCartTotals(storeId){
        const items = chatCartStore[storeId] || [];
        const totalCount = items.reduce((s,i)=>s + Number(i.cantidad||1),0);
        const totalPrice = items.reduce((s,i)=>s + (Number(i.precio||0) * Number(i.cantidad||1)),0).toFixed(2);
        const header = document.querySelector(`.chat-cart[data-store-id="${storeId}"] .chat-cart-header`);
        if (header) header.innerHTML = `🧾 <strong>Tu carrito (chat)</strong> — ${totalCount} unidades`;
        const tval = document.querySelector(`.chat-cart-footer[data-store-id="${storeId}"] .chat-cart-total-val`);
        if (tval) tval.textContent = totalPrice;
}

// Hook: detectar cuando el usuario escribe solicitando ver el carrito

// Scroll to the latest message
// Desplácese hasta el último mensaje
const scrollToLatestMessage = () => { chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth"}) };

// Create message element with dynamic classes and return it
// Crea un elemento de mensaje con clases dinámicas y devuélvelo
const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

// Utilities: process message text (images, special links) and persistence
function processMessageText(text) {
    if (!text) return '';
    let out = String(text);
    out = out.replace(/(https?:\/\/[^\s<>]+?\.(?:jpg|jpeg|png|webp|gif))/gi, (match, url) => {
        return `<img src="${url}" alt="imagen del producto" style="max-width: 180px; border-radius: 10px; margin: 5px 0;">`;
    });
    out = out.replace(/(https:\/\/willy-vilca\.github\.io\/[^\s<>"']+)([.,;!?])?/gi, (match, urlPart, trailingPunct, offset, str) => {
        const before = str.slice(Math.max(0, offset - 8), offset).toLowerCase();
        if (before.includes('src=') || before.includes('href=') || before.includes('<a ') ) return match;
        let label = '🛒👉 HAZ CLICK AQUI PARA MAS INFORMACIÒN';
        if (urlPart.includes('finalizarPedido')) label = '🛒👉 Clic aquí para concretar tu proceso de compra';
        else if (urlPart.includes('producto-info')) label = '🔍👉 Ver información del producto';
        else if (urlPart.includes('registro')) label = '✨👉 Clic aquí para registrarte en nuestra página web';
        return `<a href="${urlPart}" target="_blank" rel="noopener noreferrer" style="color:#007bff; text-decoration:none; display:inline-block; margin-top:5px;">${label}</a>${trailingPunct || ''}`;
    });
    // Detectar listas de productos y convertir a tarjetas
    const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const productItems = [];
    const itemRe = /^(?:\d+\.\s*|•\s*)(.+?)\s*[–-]\s*(?:S\/?\s*)?([0-9]+(?:[.,][0-9]{1,2})?)/i;
    for (const ln of lines) {
        const m = ln.match(itemRe);
        if (m) {
            const name = m[1].trim();
            const price = m[2].trim();
            productItems.push({ name, price });
        }
    }

    if (productItems.length > 0) {
        // Guardar items en store para paginación y devolver HTML paginado (3 por página)
        const items = productItems.map(p => ({ nombre: p.name, precio: p.price }));
        const storeId = generateStoreId();
        productPaginationStore[storeId] = { items: items, currentPage: 1, totalPages: Math.max(1, Math.ceil(items.length / PRODUCTS_PAGE_SIZE)) };
        return renderProductsPaginatedHTML(items.length, storeId);
    }

    out = out.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
    return out;
}

function escapeHtml(str){
    return String(str).replace(/[&<>\"']/g, function(s){
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[s];
    });
}

// Decode HTML entities produced by escapeHtml when reading data attributes
function decodeHtml(html){
    try{
        const d = document.createElement('div');
        d.innerHTML = String(html);
        return d.textContent || d.innerText || '';
    }catch(e){ return String(html); }
}

// Attach listeners for product card buttons (delegated)
function attachProductCardListeners(root=document) {
    root.querySelectorAll('.product-add').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', (e)=>{
            const name = btn.getAttribute('data-name');
            const price = btn.getAttribute('data-price');
            const id = btn.getAttribute('data-id') || null;
            const baseImg = 'https://backend-proyecto-distribuidora-production.up.railway.app/images/productos/';
            const encoded = encodeURIComponent((name||'').trim());
            const thumb = `${baseImg}${encoded}.jpg`;

            // Guardar intención de añadir al carrito y preguntar cantidad al usuario
            pendingAdd = { name, price, id };

            // Crear mensaje del asistente preguntando la cantidad con mini-imagen
            const botContent = `
                <svg class="bot-avatar" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024">
                    <path d="M738.3 287.6H285.7c-59 0-106.8 47.8-106.8 106.8v303.1c0 59 47.8 106.8 106.8 106.8h81.5v111.1c0 .7.8 1.1 1.4.7l166.9-110.6 41.8-.8h117.4l43.6-.4c59 0 106.8-47.8 106.8-106.8V394.5c0-59-47.8-106.9-106.8-106.9zM351.7 448.2c0-29.5 23.9-53.5 53.5-53.5s53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5-53.5-23.9-53.5-53.5zm157.9 267.1c-67.8 0-123.8-47.5-132.3-109h264.6c-8.6 61.5-64.5 109-132.3 109zm110-213.7c-29.5 0-53.5-23.9-53.5-53.5s23.9-53.5 53.5-53.5 53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5zM867.2 644.5V453.1h26.5c19.4 0 35.1 15.7 35.1 35.1v121.1c0 19.4-15.7 35.1-35.1 35.1h-26.5zM95.2 609.4V488.2c0-19.4 15.7-35.1 35.1-35.1h26.5v191.3h-26.5c-19.4 0-35.1-15.7-35.1-35.1zM561.5 149.6c0 23.4-15.6 43.3-36.9 49.7v44.9h-30v-44.9c-21.4-6.5-36.9-26.3-36.9-49.7 0-28.6 23.3-51.9 51.9-51.9s51.9 23.3 51.9 51.9z"></path>
                </svg>
                <div class="message-text">
                    <div style="display:flex;gap:8px;align-items:center;">
                        <img src="${thumb}" alt="${escapeHtml(name)}" style="width:44px;height:44px;border-radius:6px;object-fit:cover;" onerror="this.src='${baseImg}default.jpg'" />
                        <div>¿Cuántas unidades de <strong>${escapeHtml(name)}</strong> deseas agregar?</div>
                    </div>
                </div>`;

            const botMsgEl = createMessageElement(botContent, 'bot-message');
            chatBody.appendChild(botMsgEl);
            // Guardar en historial para persistencia
            chatHistory.push({ role: 'assistant', text: `¿Cuántas unidades de ${name} deseas agregar?` });
            saveMessages();
            scrollToLatestMessage();

            // No ejecutar la acción inmediata de agregar; esperaremos la respuesta del usuario
            // Liberar el binding temporal después un breve tiempo para permitir re-click
            setTimeout(()=>{ btn.dataset.bound=''; }, 1200);
        });
    });

    // manejar botones 'Ver más' para nombres largos (toggle)
    root.querySelectorAll('.product-more').forEach(btn => {
        if (btn.dataset.boundMore) return;
        btn.dataset.boundMore = '1';
        btn.addEventListener('click', (e) => {
            const card = btn.closest('.product-card');
            if (!card) return;
            const nameEl = card.querySelector('.product-name');
            if (!nameEl) return;
            const b = btn;
            if (!nameEl.classList.contains('clamp-2')) {
                nameEl.classList.add('clamp-2');
                b.textContent = 'Ver más';
                b.setAttribute('aria-expanded','false');
            } else {
                nameEl.classList.remove('clamp-2');
                b.textContent = 'Ver menos';
                b.setAttribute('aria-expanded','true');
            }
        });
    });
    // ocultar botones 'Ver más' cuando el texto no excede las 2 lineas
    root.querySelectorAll('.product-more').forEach(btn => {
        const card = btn.closest('.product-card');
        if (!card) return;
        const nameEl = card.querySelector('.product-name');
        if (!nameEl) return;
        // For measurement, temporarily remove clamp to get natural height
        const wasClamped = nameEl.classList.contains('clamp-2');
        if (wasClamped) nameEl.classList.remove('clamp-2');
        const lineHeight = parseFloat(getComputedStyle(nameEl).lineHeight) || (parseFloat(getComputedStyle(nameEl).fontSize) * 1.1);
        const maxH = lineHeight * 2 + 1; // small tolerance
        const needsMore = nameEl.scrollHeight > maxH;
        if (!needsMore) btn.style.display = 'none';
        if (wasClamped) nameEl.classList.add('clamp-2');
    });
    // abrir vista detallada del producto en modal
    root.querySelectorAll('.product-view').forEach(btn => {
        if (btn.dataset.boundView) return;
        btn.dataset.boundView = '1';
        btn.addEventListener('click', (e) => {
            const name = btn.getAttribute('data-name');
            const price = btn.getAttribute('data-price');
            const viewUrl = btn.getAttribute('data-view-url');
            const descripcion = btn.getAttribute('data-desc');
            const stock = btn.getAttribute('data-stock');
            const id = btn.getAttribute('data-id');
            showProductDetail({ name, price, viewUrl, descripcion, stock, id });
        });
    });
}

// Mostrar modal con detalle del producto
function showProductDetail({ name, price, viewUrl, descripcion, stock, id }){
    try{
        // evitar duplicados
        if(document.querySelector('.product-detail-overlay')) return;

        const baseImg = 'https://backend-proyecto-distribuidora-production.up.railway.app/images/productos/';
        const encoded = encodeURIComponent(name.trim());
        const imgSrc = `${baseImg}${encoded}.jpg`;

        const overlay = document.createElement('div');
        overlay.className = 'product-detail-overlay';
        overlay.style = `position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;`;

        const box = document.createElement('div');
        box.className = 'product-detail-box';
        box.style = `width:100%;max-width:720px;background:#fff;border-radius:12px;padding:18px;box-shadow:0 8px 30px rgba(0,0,0,0.2);overflow:auto;max-height:90vh;`;

        box.innerHTML = `
            <div style="display:flex;gap:12px;align-items:flex-start;">
                <div style="flex:0 0 180px;">
                    <img src="${imgSrc}" alt="${escapeHtml(name)}" onerror="this.src='${baseImg}default.jpg'" style="width:100%;border-radius:8px;object-fit:cover;" />
                </div>
                <div style="flex:1;">
                    <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">
                        <div>
                            <h3 style="margin:0 0 8px 0;">${escapeHtml(name)}</h3>
                            <div style="color:#333;margin-bottom:10px;font-weight:600;">S/ ${escapeHtml(String(price || '0'))}</div>
                        </div>
                        <button class="product-detail-close" style="background:transparent;border:none;font-size:20px;cursor:pointer;">✕</button>
                    </div>
                    <p class="product-detail-desc" style="color:#555;margin-top:6px;">Cargando descripción...</p>
                    <div style="margin-top:6px;color:#666;font-size:13px;">Stock: <span class="product-detail-stock">-</span></div>

                    <div style="margin-top:16px;display:flex;gap:8px;align-items:center;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <button class="qty-decrease" style="width:36px;height:36px;border-radius:6px;border:1px solid #ddd;">-</button>
                            <span class="qty-count" style="min-width:28px;text-align:center;display:inline-block;">1</span>
                            <button class="qty-increase" style="width:36px;height:36px;border-radius:6px;border:1px solid #ddd;">+</button>
                        </div>

                        <button class="product-detail-add" style="background:#28a745;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">Agregar al carrito</button>
                        <a class="product-detail-viewweb" href="${viewUrl}" target="_blank" rel="noopener noreferrer" style="margin-left:auto;background:#007bff;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;">Ver en la web</a>
                    </div>
                </div>
            </div>`;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const closeBtn = box.querySelector('.product-detail-close');
        const qtyDec = box.querySelector('.qty-decrease');
        const qtyInc = box.querySelector('.qty-increase');
        const qtyCount = box.querySelector('.qty-count');
        const addBtn = box.querySelector('.product-detail-add');
        const stockEl = box.querySelector('.product-detail-stock');
        const descEl = box.querySelector('.product-detail-desc');

        // Ajustar enlace 'Ver en la web' para usar ruta file:/// con id cuando esté disponible
        try {
            const viewLink = box.querySelector('.product-detail-viewweb');
            if (viewLink) {
                if (id) {
                    const filePath = `https://willy-vilca.github.io/FrontEnd-Proyecto-Distribuidora/producto-info.html?id=${encodeURIComponent(id)}`;
                    viewLink.setAttribute('href', filePath);
                    viewLink.setAttribute('target', '_blank');
                } else if (viewUrl) {
                    viewLink.setAttribute('href', viewUrl);
                }
            }
        } catch (e) { /* ignore */ }

        let maxStock = Infinity;

        function closeModal(){ overlay.remove(); }

        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (ev)=>{ if(ev.target === overlay) closeModal(); });

        qtyInc.addEventListener('click', ()=>{
            const current = Number(qtyCount.textContent||'1');
            if (current < maxStock) qtyCount.textContent = String(current + 1);
        });
        qtyDec.addEventListener('click', ()=>{ const v = Math.max(1, Number(qtyCount.textContent||'1')-1); qtyCount.textContent = String(v); });

        addBtn.addEventListener('click', ()=>{
            const qty = Number(qtyCount.textContent||1);
            if (qty > maxStock) {
                alert('No puedes pedir más que el stock disponible.');
                return;
            }

            // Integrar con carrito principal (funcionalidades.js) y usar mostrarNotificacionChatbot
            try {
                let carrito = [];
                if (typeof getCarrito === 'function') {
                    carrito = getCarrito() || [];
                } else {
                    carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
                }

                let prodId = null;
                if (id) {
                    const asNum = Number(id);
                    prodId = Number.isFinite(asNum) && asNum > 0 ? asNum : Date.now();
                } else {
                    prodId = Date.now();
                }

                let precioNum = 0;
                try {
                    const raw = String(price || '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
                    precioNum = parseFloat(raw) || 0;
                } catch (err) { precioNum = 0; }

                const nombre = name || 'Producto';
                const cantidad = qty;

                let existing = carrito.find(p => p.id === prodId || String(p.nombre) === String(nombre));
                if (existing) {
                    existing.cantidad = (existing.cantidad || existing.qty || 0) + cantidad;
                    existing.precio = existing.precio || existing.price || precioNum;
                } else {
                    const item = {
                        id: prodId,
                        nombre: nombre,
                        precio: precioNum,
                        cantidad: cantidad,
                        stock: typeof stock !== 'undefined' ? Number(stock) : 9999
                    };
                    carrito.push(item);
                }

                if (typeof saveCarrito === 'function') {
                    saveCarrito(carrito);
                } else {
                    localStorage.setItem('carrito', JSON.stringify(carrito));
                    try { if (typeof actualizarBotonCarrito === 'function') actualizarBotonCarrito(); } catch(e){}
                    try { if (typeof actualizarBotonFlotanteCarrito === 'function') actualizarBotonFlotanteCarrito(); } catch(e){}
                }

                try { if (typeof mostrarNotificacionChatbot === 'function') mostrarNotificacionChatbot(`Se han agregado ${cantidad} unidad(es) de ${nombre} al carrito.`); } catch(e){ console.warn(e); }
            } catch (err) {
                console.warn('Error al agregar al carrito desde modal', err);
                try { if (typeof mostrarNotificacionChatbot === 'function') mostrarNotificacionChatbot('No se pudo agregar el producto al carrito.'); } catch(e){}
            }

            closeModal();
        });

        // Si se proporcionaron descripcion/stock desde la tarjeta, úsalos y evita fetch
        const hasDesc = typeof descripcion !== 'undefined' && descripcion !== null && String(descripcion).trim().length > 0;
        const hasStock = typeof stock !== 'undefined' && stock !== null && String(stock).trim().length > 0;
        if (hasDesc || hasStock) {
            try {
                if (hasDesc) descEl.textContent = String(descripcion).trim();
                else descEl.textContent = 'Descripción no disponible. Haz clic en "Ver en la web" para más detalles.';

                if (hasStock) {
                    const stockNum = Number(String(stock).trim());
                    if (Number.isNaN(stockNum)) {
                        stockEl.textContent = '-';
                        maxStock = Infinity;
                    } else {
                        maxStock = Math.max(0, Math.floor(stockNum));
                        stockEl.textContent = String(maxStock);
                        const current = Number(qtyCount.textContent || '1');
                        if (current > maxStock) qtyCount.textContent = String(Math.max(1, maxStock));
                        if (maxStock <= 0) {
                            addBtn.disabled = true;
                            addBtn.style.opacity = '0.6';
                            qtyInc.disabled = true;
                            qtyDec.disabled = true;
                            qtyCount.textContent = '0';
                            descEl.textContent = descEl.textContent + ' (Producto agotado)';
                        } else {
                            addBtn.disabled = false;
                            addBtn.style.opacity = '';
                            qtyInc.disabled = false;
                            qtyDec.disabled = false;
                        }
                    }
                } else {
                    stockEl.textContent = '-';
                    maxStock = Infinity;
                }
            } catch (e) { console.warn('showProductDetail local data error', e); }
        } else {
            // Cargar descripción y stock desde backend (usar campos 'descripcion' y 'stock')
            (async ()=>{
                try{
                    // El nombre puede venir HTML-escaped por data attributes (escapeHtml),
                    // decodificamos antes de construir la URL para que la búsqueda en BD coincida.
                    const rawName = decodeHtml(name);
                    const api = 'https://san-martin-proyecto.onrender.com:10000/product?name=' + encodeURIComponent(rawName);
                    const resp = await fetch(api);
                    if (!resp.ok) throw new Error('No encontrado');
                    const json = await resp.json();
                    const prod = json && json.product ? json.product : null;
                    if (prod) {
                        // Usar explícitamente los campos de la BD
                        const desc = typeof prod.descripcion !== 'undefined' ? prod.descripcion : (prod.description || prod.detalle || '');
                        const stockRaw = typeof prod.stock !== 'undefined' ? prod.stock : (typeof prod.cantidad !== 'undefined' ? prod.cantidad : null);
                        const stockNum = stockRaw === null ? null : Number(stockRaw);

                        descEl.textContent = desc && String(desc).trim().length ? String(desc) : 'Descripción no disponible. Haz clic en "Ver en la web" para más detalles.';

                        if (stockNum === null || Number.isNaN(stockNum)) {
                            stockEl.textContent = '-';
                            maxStock = Infinity;
                        } else {
                            maxStock = Math.max(0, Math.floor(stockNum));
                            stockEl.textContent = String(maxStock);

                            // Ajustar contador actual si supera stock
                            const current = Number(qtyCount.textContent || '1');
                            if (current > maxStock) qtyCount.textContent = String(Math.max(1, maxStock));

                            if (maxStock <= 0) {
                                addBtn.disabled = true;
                                addBtn.style.opacity = '0.6';
                                qtyInc.disabled = true;
                                qtyDec.disabled = true;
                                qtyCount.textContent = '0';
                                descEl.textContent = descEl.textContent + ' (Producto agotado)';
                            } else {
                                addBtn.disabled = false;
                                addBtn.style.opacity = '';
                                qtyInc.disabled = false;
                                qtyDec.disabled = false;
                            }
                        }
                    } else {
                        descEl.textContent = 'Descripción no disponible.';
                        stockEl.textContent = '-';
                    }
                }catch(err){
                    descEl.textContent = 'Error al cargar descripción.';
                    stockEl.textContent = '-';
                    console.warn('Error fetching product:', err);
                }
            })();
        }

    }catch(e){ console.warn('showProductDetail error', e); }
}

function addToCart(item){
    try{
        const key = 'chatbot_cart_v1';
        const raw = localStorage.getItem(key);
        const cart = raw ? JSON.parse(raw) : [];
        const qty = item.qty && Number(item.qty) > 0 ? Number(item.qty) : 1;
        cart.push({ name: item.name, price: item.price, qty: qty, ts: Date.now() });
        localStorage.setItem(key, JSON.stringify(cart));
    }catch(e){ console.warn('No se pudo agregar al carrito', e); }
}

function saveMessages() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
    } catch (e) {
        console.warn('No se pudo guardar el historial en localStorage', e);
    }
}

function loadMessages() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        return [];
    } catch (e) {
        console.warn('No se pudo leer historial de localStorage', e);
        return [];
    }
}

function renderMessage(msg) {
    if (!msg || !msg.role) return null;
    if (msg.role === 'user') {
        const content = `<div class="message-text"></div>`;
        const el = createMessageElement(content, 'user-message');
        el.querySelector('.message-text').textContent = msg.text || '';
        return el;
    } else {
        const content = `
            <svg class="bot-avatar" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024">
                <path d="M738.3 287.6H285.7c-59 0-106.8 47.8-106.8 106.8v303.1c0 59 47.8 106.8 106.8 106.8h81.5v111.1c0 .7.8 1.1 1.4.7l166.9-110.6 41.8-.8h117.4l43.6-.4c59 0 106.8-47.8 106.8-106.8V394.5c0-59-47.8-106.9-106.8-106.9zM351.7 448.2c0-29.5 23.9-53.5 53.5-53.5s53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5-53.5-23.9-53.5-53.5zm157.9 267.1c-67.8 0-123.8-47.5-132.3-109h264.6c-8.6 61.5-64.5 109-132.3 109zm110-213.7c-29.5 0-53.5-23.9-53.5-53.5s23.9-53.5 53.5-53.5 53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5zM867.2 644.5V453.1h26.5c19.4 0 35.1 15.7 35.1 35.1v121.1c0 19.4-15.7 35.1-35.1 35.1h-26.5zM95.2 609.4V488.2c0-19.4 15.7-35.1 35.1-35.1h26.5v191.3h-26.5c-19.4 0-35.1-15.7-35.1-35.1zM561.5 149.6c0 23.4-15.6 43.3-36.9 49.7v44.9h-30v-44.9c-21.4-6.5-36.9-26.3-36.9-49.7 0-28.6 23.3-51.9 51.9-51.9s51.9 23.3 51.9 51.9z"></path>
            </svg>
            <div class="message-text"></div>`;
        const el = createMessageElement(content, 'bot-message');
        el.querySelector('.message-text').innerHTML = processMessageText(msg.text || '');
        return el;
    }
}

function renderAllMessages() {
    chatBody.innerHTML = '';
    for (const m of chatHistory) {
        const el = renderMessage(m);
        if (el) chatBody.appendChild(el);
    }
    scrollToLatestMessage();
}

// Load persisted history right away
chatHistory = loadMessages();
if (chatHistory.length) renderAllMessages();
// Registrar listeners para tarjetas ya renderizadas (si las hay)
try { attachProductCardListeners(document); } catch(e){/* ignore */}
try { initializePaginationIn(document); } catch(e) { /* ignore */ }

// Si existe un carrito del chat persistido, mostrarlo en el chat al cargar la página
try{
    const persisted = loadChatCartFromStorage();
    if (persisted && persisted.storeId) {
        // evitar duplicados
        if (!document.querySelector(`.chat-cart[data-store-id="${persisted.storeId}"]`)) {
            // showChatCart reutilizará el storeId guardado
            showChatCart();
        }
    }
}catch(e){ console.warn('auto-show persisted chat cart error', e); }

// Generate bot response using API
// Generar respuesta de bot usando API
const generateBotResponse = async (incomingMessageDiv) => {
    const messageElement = incomingMessageDiv.querySelector(".message-text");

    try {
        // Llamada a tu backend (server.js)
        const response = await fetch("https://san-martin-proyecto.onrender.com:10000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: userData.message })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Error en backend");
        const apiResponseText = data.answer || "";

        // Si el backend incluye un array estructurado `products`, renderízalo directamente
        if (Array.isArray(data.products) && data.products.length > 0) {
            // Registrar los productos en el store y mostrar paginador
            const items = data.products.map(p => ({ id: p.id, nombre: p.nombre, descripcion: p.descripcion, precio: p.precio, stock: p.stock }));
            const storeId = generateStoreId();
            productPaginationStore[storeId] = { items: items, currentPage: 1, totalPages: Math.max(1, Math.ceil(items.length / PRODUCTS_PAGE_SIZE)) };
            messageElement.innerHTML = renderProductsPaginatedHTML(items.length, storeId);
            try { attachProductCardListeners(messageElement); } catch (err) { console.warn('attachProductCardListeners error', err); }
            // Inicializar paginación dentro del elemento
            try { initializePaginationIn(messageElement); } catch (err) { console.warn('initializePaginationIn error', err); }
        } else {
            // Procesar y mostrar respuesta del bot normal (texto)
            const processedHtml = processMessageText(apiResponseText);
            messageElement.innerHTML = processedHtml;
            try { attachProductCardListeners(messageElement); } catch (err) { console.warn('attachProductCardListeners error', err); }
            try { initializePaginationIn(messageElement); } catch (err) { /* no paginators present */ }
        }

    // Guardar en historial y persistir
    const modelMsg = { role: 'model', text: apiResponseText, ts: Date.now() };
    chatHistory.push(modelMsg);
    saveMessages();

    } catch (error) {
        console.error(error);
        messageElement.innerText = error.message;
        messageElement.style.color = "#ff0000";
    } finally {
        userData.file = {};
        incomingMessageDiv.classList.remove("thinking");
        scrollToLatestMessage();
    }
};


// Handle outgoing user messages
// Gestionar mensajes salientes de usuario
const handleOutgoingMessage = (e) => {
    e.preventDefault();
    userData.message = messageInput.value.trim();
    messageInput.value = "";
    fileUploadWrapper.classList.remove("file-uploaded");
    messageInput.dispatchEvent(new Event("input"));

    // Create display user message
    // Crear mensaje de usuario para mostrar
    const messageContent = `<div class="message-text"></div>
                            ${userData.file.data ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="attachment" />` : ""}`;

    const outgoingMessageDiv = createMessageElement(messageContent, "user-message");
    outgoingMessageDiv.querySelector(".message-text").textContent = userData.message;
    chatBody.appendChild(outgoingMessageDiv);
    scrollToLatestMessage();
    // Guardar mensaje de usuario en historial y persistir
    const userMsg = { role: 'user', text: userData.message, ts: Date.now() };
    chatHistory.push(userMsg);
    saveMessages();

    // Si el usuario pide ver el carrito (y no hay pendingAdd), mostramos un carrito visual dentro del chat
    if (!pendingAdd) {
        try{
            const txt = String(userData.message || '').toLowerCase();
            const cartTriggers = ['carrito','mi carrito','ver carrito','mostrar carrito','mostrar mi carrito','ver mi carrito','ver el carrito','mostrar el carrito','abrir carrito','mostrar mis productos','ver mis productos','checkout','finalizar pago','finalizar pedido','terminar compra','pagar'];
            const matches = cartTriggers.some(k => txt.includes(k));
            if (matches) {
                showChatCart();
                return;
            }
        }catch(e){}
    }

    // Si hay una intención pendiente de 'Agregar' producto, interpretar la respuesta del usuario como cantidad
    if (pendingAdd) {
        const qtyStr = String(userData.message || '').trim();
        const qtyNum = Number(qtyStr);
        if (/^\d+$/.test(qtyStr) && qtyNum > 0) {
            // Añadir al carrito del sitio (integración con `funcionalidades.js`)
            try {
                // Obtener carrito existente usando la API global si existe
                let carrito = [];
                if (typeof getCarrito === 'function') {
                    carrito = getCarrito() || [];
                } else {
                    carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
                }

                // Determinar id numérico estable
                let prodId = null;
                if (pendingAdd.id) {
                    const asNum = Number(pendingAdd.id);
                    prodId = Number.isFinite(asNum) && asNum > 0 ? asNum : Date.now();
                } else {
                    prodId = Date.now();
                }

                // Normalizar precio a número
                let precioNum = 0;
                try {
                    const raw = String(pendingAdd.price || '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
                    precioNum = parseFloat(raw) || 0;
                } catch (err) { precioNum = 0; }

                const nombre = pendingAdd.name || 'Producto';
                const cantidad = qtyNum;

                // Buscar si el producto ya está en el carrito por id
                let existing = carrito.find(p => p.id === prodId || String(p.nombre) === String(nombre));
                if (existing) {
                    // Sumar cantidad
                    existing.cantidad = (existing.cantidad || existing.qty || 0) + cantidad;
                    // mantener precio/stock si estaba definido
                    existing.precio = existing.precio || existing.price || precioNum;
                } else {
                    // Estructura esperada por `funcionalidades.js`: { id, nombre, precio, cantidad, stock }
                    const item = {
                        id: prodId,
                        nombre: nombre,
                        precio: precioNum,
                        cantidad: cantidad,
                        stock: typeof pendingAdd.stock !== 'undefined' ? Number(pendingAdd.stock) : 9999
                    };
                    carrito.push(item);
                }

                // Guardar usando API global si existe
                if (typeof saveCarrito === 'function') {
                    saveCarrito(carrito);
                } else {
                    localStorage.setItem('carrito', JSON.stringify(carrito));
                    try { if (typeof actualizarBotonCarrito === 'function') actualizarBotonCarrito(); } catch(e){}
                    try { if (typeof actualizarBotonFlotanteCarrito === 'function') actualizarBotonFlotanteCarrito(); } catch(e){}
                }

                const confText = `Se han agregado ${cantidad} unidad(es) de ${nombre} al carrito.`;
                try { if (typeof mostrarNotificacionChatbot === 'function') mostrarNotificacionChatbot(confText); } catch(e){ console.warn(e); }
            } catch (err) {
                console.warn('Error al agregar al carrito desde chatbot', err);
                try { if (typeof mostrarNotificacionChatbot === 'function') mostrarNotificacionChatbot('No se pudo agregar el producto al carrito.'); } catch(e){}
            }
            // limpiar estado pendiente
            pendingAdd = null;
            return;
        } else {
            // Respuesta inválida: pedir que indique número válido y mantener pendingAdd
            const askText = 'Por favor indica una cantidad válida (número entero mayor que 0).';
            try { if (typeof mostrarNotificacionChatbot === 'function') { mostrarNotificacionChatbot(askText); } else { console.warn('mostrarNotificacionChatbot no definida'); } } catch(e){ console.warn(e); }
            return;
        }
    }

    // Simulate bot response with thinking indicator after a delay
    // Simular la respuesta del bot con el indicador de pensamiento después de un retraso
    setTimeout(() => {
        const messageContent = `
                <svg class="bot-avatar" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024">
                    <path d="M738.3 287.6H285.7c-59 0-106.8 47.8-106.8 106.8v303.1c0 59 47.8 106.8 106.8 106.8h81.5v111.1c0 .7.8 1.1 1.4.7l166.9-110.6 41.8-.8h117.4l43.6-.4c59 0 106.8-47.8 106.8-106.8V394.5c0-59-47.8-106.9-106.8-106.9zM351.7 448.2c0-29.5 23.9-53.5 53.5-53.5s53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5-53.5-23.9-53.5-53.5zm157.9 267.1c-67.8 0-123.8-47.5-132.3-109h264.6c-8.6 61.5-64.5 109-132.3 109zm110-213.7c-29.5 0-53.5-23.9-53.5-53.5s23.9-53.5 53.5-53.5 53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5zM867.2 644.5V453.1h26.5c19.4 0 35.1 15.7 35.1 35.1v121.1c0 19.4-15.7 35.1-35.1 35.1h-26.5zM95.2 609.4V488.2c0-19.4 15.7-35.1 35.1-35.1h26.5v191.3h-26.5c-19.4 0-35.1-15.7-35.1-35.1zM561.5 149.6c0 23.4-15.6 43.3-36.9 49.7v44.9h-30v-44.9c-21.4-6.5-36.9-26.3-36.9-49.7 0-28.6 23.3-51.9 51.9-51.9s51.9 23.3 51.9 51.9z"></path>
                </svg>
                <div class="message-text">
                    <div class="thinking-indicator">
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                    </div>
                </div>`;

        const incomingMessageDiv = createMessageElement(messageContent, "bot-message", "thinking");
        chatBody.appendChild(incomingMessageDiv);
        scrollToLatestMessage();
        generateBotResponse(incomingMessageDiv);
    }, 600);
};

// Handle Enter key press for sending messages
// Manejar la pulsación de la tecla 'Enter' para enviar mensajes
messageInput.addEventListener("keydown", (e) => {
    const userMessage = e.target.value.trim();
    if(e.key === "Enter" && userMessage && !e.shiftKey && window.innerWidth > 768){
        handleOutgoingMessage(e);
    }
});

// Adjust input field height dynamically
// Ajustar la altura del campo de entrada dinámicamente
messageInput.addEventListener("input",() => {
    messageInput.style.height = `${initialInputHeight}px`;
    messageInput.style.height = `${messageInput.scrollHeight}px`;
    document.querySelector(".chat-form").style.borderRadius = messageInput.scrollHeight > initialInputHeight ? "15px" : "32px";
});

// Handle file input change and preview the selected file
// Manejar el cambio de entrada del archivo y obtener una vista previa del archivo seleccionado
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        fileUploadWrapper.querySelector("img").src = e.target.result;
        fileUploadWrapper.classList.add("file-uploaded");
        const base64String = e.target.result.split(",")[1];

        // Store file data in userData
        // Almacenar datos de archivos en userData
        userData.file = {
            data: base64String,
            mime_type: file.type
        }

        fileInput.value = "";
    }

    reader.readAsDataURL(file);
});

// Cancel file upload
// Cancelar la carga de archivos
fileCancelButton.addEventListener("click", () => {
    userData.file = {};
    fileUploadWrapper.classList.remove("file-uploaded");
});

// Initialize emoji picker and handle emoji selection
// Inicializar el selector de emojis y manejar la selección de emojis
const picker = new EmojiMart.Picker({
    theme: "light",
    skinTonePosition: "none",
    previewPosition: "none",
    onEmojiSelect: (emoji) => {
        const { selectionStart: start, selectionEnd: end } = messageInput;
        messageInput.setRangeText(emoji.native, start, end, "end");
        messageInput.focus();
    },
    onClickOutside: (e) => {
        if(e.target.id === "emoji-picker") {
            document.body.classList.toggle("show-emoji-picker");
        } else {
            document.body.classList.remove("show-emoji-picker");
        }
    }
});

document.querySelector(".chat-form").appendChild(picker);

sendMessageButton.addEventListener("click", (e) => handleOutgoingMessage(e));
document.querySelector("#file-upload").addEventListener("click", () => fileInput.click());
chatbotToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));

CloseChatbot.addEventListener("click", () => document.body.classList.remove("show-chatbot"));