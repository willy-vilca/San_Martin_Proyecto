document.addEventListener("DOMContentLoaded", () => {
  const userSection = document.getElementById("seccionUsuario");
  const usuario = JSON.parse(localStorage.getItem("usuario"));

  if (usuario) { 
    const primerNombre = usuario.nombre.trim().split(" ")[0];
    userSection.innerHTML = `
      <div class="dropdown">
        <button class="btn btn-outline-danger py-3 px-xxl-5 dropdown-toggle backgroundHover-rojo d-flex align-items-center justify-content-center" 
                type="button" id="userMenu" data-bs-toggle="dropdown" aria-expanded="false" style="width:100%;">
          <i class="bi bi-person-circle me-2"></i> ${primerNombre}
        </button>
        <ul class="dropdown-menu text-center" aria-labelledby="userMenu">
          <li><a class="dropdown-item " href="#" data-bs-toggle="modal" data-bs-target="#modalDatosUsuario">Datos Personales</a></li>
          <li><a class="dropdown-item " href="cambiarcontraseña.html">Cambiar contraseña</a></li>
          <li><a class="dropdown-item fw-semibold" href="misPedidos.html">Mis pedidos</a></li>
          <li><a class="dropdown-item fw-bold" style="color:rgb(228, 30, 30);" href="#" id="cerrarSesion">Cerrar sesión</a></li>
        </ul>
      </div>
    `;

    const botonVerMisPedidos = document.getElementById("botonVerMisPedidos");
    botonVerMisPedidos.disabled=false;
    
    botonVerMisPedidos.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "misPedidos.html";
    })

    document.getElementById("cerrarSesion").addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("usuario");
      localStorage.removeItem("carrito");
      window.location.href = "index.html";
    });
  }

  actualizarBotonCarrito();
  actualizarBotonFlotanteCarrito();
});




//Funcion para agregar o disminuir la cantidad de productos en las tarjetas
function updateQty(btn, change) {
      const input = btn.parentNode.querySelector("input");
      let value = parseInt(input.value) || 1;
      value += change;
      if (value < 1) value = 1;
      input.value = value;
}

//funcion para el menú desplegable de productos
document.querySelectorAll('.dropdown-menu [data-bs-toggle="dropdown"]').forEach(function(element) {
    element.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  });

  

/*funcionalidades del carrito de compras*/

// Función para obtener el url de la imagen de un producto
  function getImageUrl(producto) {
    return `https://backend-proyecto-distribuidora-production.up.railway.app/images/productos/${producto}.jpg`;
  }

// Funciones para manejar localStorage
function getCarrito() {
  return JSON.parse(localStorage.getItem("carrito")) || [];
}

function saveCarrito(carrito) {
  localStorage.setItem("carrito", JSON.stringify(carrito));
  actualizarBotonCarrito();
  actualizarBotonFlotanteCarrito();
}

function actualizarBotonCarrito(){
  const botonPrincipal = document.getElementById('carritoBotonPrincipal');
  let cantidadProductosCarrito = getCarrito().length;
  if (cantidadProductosCarrito > 0) {
    botonPrincipal.innerHTML = `CARRITO <span class='fw-medium'>(${cantidadProductosCarrito})</span>`;
  } else {
    botonPrincipal.innerHTML = `CARRITO`;
  }
}

function actualizarBotonFlotanteCarrito(){
  const botonFlotante = document.getElementById('burbujaCarrito');
  if(botonFlotante==null) return;
  let cantidadProductosCarrito = getCarrito().length;
  botonFlotante.textContent = cantidadProductosCarrito;
  if (cantidadProductosCarrito > 0) {
  botonFlotante.classList.add('show');
  } else {
    botonFlotante.classList.remove('show');
  }
}

// Renderizar carrito
function renderCarrito() {
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");
  const minimoMensaje = document.getElementById("minimoMensaje");
  const btnFinalizar = document.getElementById("btnFinalizarPedido");
  let carrito = getCarrito();

  cartItems.innerHTML = "";
  let total = 0;

  carrito.forEach(producto => {
    let subtotal = producto.precio * producto.cantidad;
    total += subtotal;

    let item = document.createElement("div");
    item.classList.add("cart-item", "shadow");

    item.innerHTML = `
      <div class="d-flex align-items-center">
        <a href="producto-info.html?id=${producto.id}">
          <img src="${getImageUrl(producto.nombre)}" alt="${producto.nombre}" class="product-img me-2" 
          onerror="this.onerror=null; this.src='https://backend-proyecto-distribuidora-production.up.railway.app/images/default.jpg';">
        </a>
        <span class="text-truncate product-name"><a href="producto-info.html?id=${producto.id}" class="text-dark text-truncate product-name">${producto.nombre}</a></span>
      </div>
      <div class="d-flex align-items-center product-actions">
        <div class="input-group input-group-sm me-1">
          <button class="btn" onclick="cambiarCantidad(${producto.id}, -1)">-</button>
          <input type="number" class="form-control text-center cantidadProducto" value="${producto.cantidad}" readonly>
          <button class="btn" onclick="cambiarCantidad(${producto.id}, 1)">+</button>
        </div>
        <span class="text-danger fw-bold me-2">Total: S/.${parseFloat(subtotal).toFixed(2)}</span>
        <button class="btn btn-remove ms-5" onclick="eliminarProducto(${producto.id})">✕</button>
      </div>
    `;
    cartItems.appendChild(item);
  });

  cartTotal.textContent = "S/." + parseFloat(total).toFixed(2);

  if (total < 100) {
    minimoMensaje.style.display = "flex";
    minimoMensaje.style.animation = "fadeIn 0.8s ease forwards";
    btnFinalizar.disabled = true;
    btnFinalizar.classList.add("opacity-50");
    btnFinalizar.style.cursor = "not-allowed";
  } else {
    minimoMensaje.style.animation = "fadeOut 0.4s ease forwards";
    setTimeout(() => {
      minimoMensaje.style.display = "none";
    }, 350);
    btnFinalizar.disabled = false;
    btnFinalizar.classList.remove("opacity-50");
    btnFinalizar.style.cursor = "pointer";
  }
}


function cambiarCantidad(id, delta) {
  let carrito = getCarrito();
  let producto = carrito.find(p => p.id === id);
  if (!producto) return;

  producto.cantidad += delta;
  if (producto.cantidad < 1) producto.cantidad = 1;
  if (producto.cantidad > producto.stock){
    producto.cantidad = producto.stock;
    mostrarModalMensaje(`Lo Sentimos, no contamos con más unidades de este producto, 
    el stock disponible es de <strong>${producto.stock} Unidades.</strong>`);
  }

  saveCarrito(carrito);
  renderCarrito();
}


function eliminarProducto(id) {
  let carrito = getCarrito().filter(p => p.id !== id);
  saveCarrito(carrito);
  renderCarrito();
}


function vaciarCarrito() {
  saveCarrito([]);
  renderCarrito();
}


function finalizarPedido() {
  const usuarioExiste = JSON.parse(localStorage.getItem("usuario"));
  //se verifica si el usuario inicio sesion o no
  if(usuarioExiste){
    window.location.href = "finalizarPedido.html";
  }else{
    mostrarModal('¡Registrate para continuar!',`Debes iniciar sesion para poder realizar un pedido, puedes hacerlo dirigiéndote al botón 
      <a href="login.html" class="fw-bold link-danger link-offset-2 link-underline-opacity-25 link-underline-opacity-100-hover">
      Ingresar.
      </a>`);
  }
  
}


document.addEventListener("DOMContentLoaded", () => {
  renderCarrito();
});

//cargar productos al presionar el botón del carrito
const botonesCarrito = document.querySelectorAll('[data-bs-target="#cartModal"]');
Array.from(botonesCarrito).forEach(function(boton) {
  boton.addEventListener('click', function() {
      renderCarrito();
  });
});

/*Fin del carrito de compras */ 


/*Funcion boton flotante*/
const btnArriba = document.getElementById("btnArriba");
const btnCarrito = document.getElementById("btnCarrito");

window.addEventListener("scroll", () => {
  if (window.scrollY > 200) {
    btnArriba.classList.add("show");
    if(btnCarrito==null) return;
    btnCarrito.classList.add("show");
  } else {
    btnArriba.classList.remove("show");
    if(btnCarrito==null) return;
    btnCarrito.classList.remove("show");
  }
});

btnArriba.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
/*Fin boton flotante*/


//funcionalidad del boton de busqueda
const botonBusqueda = document.getElementById('botonBusqueda');
const textoBuscado = document.getElementById('textoBuscado');
botonBusqueda.addEventListener("click", function() {
  window.location.href = `productos-search.html?busqueda=${textoBuscado.value}`;
})

//funcionalidad de la ventana emergente de mensajes
function mostrarModal(titulo, mensaje, paginaSiguiente = 'javascript:void(0)', idFocus = '') {
  const modal = document.getElementById("modalMensaje");
  const tituloModal = document.getElementById("modal-titulo");
  const mensajeModal = document.getElementById("modal-info");
  const closeBtn = modal.querySelector(".modal-close");

  tituloModal.textContent = titulo;
  mensajeModal.innerHTML = mensaje;

  modal.style.display = "flex";

  closeBtn.onclick = () => {
    modal.style.display = "none";
    window.location.href = paginaSiguiente;
    document.getElementById(idFocus).focus();
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
      window.location.href = paginaSiguiente;
      document.getElementById(idFocus).focus();    
    }
  };
}


//notificaciones
function mostrarNotificacion(mensaje) {
  const notificaciones = document.getElementById("notificaciones");

  const notif = document.createElement("div");
  notif.classList.add("notificacion");
  notif.innerHTML = mensaje;

  notificaciones.appendChild(notif);

  setTimeout(() => {
    notif.classList.add("mostrar");
  }, 100);

  setTimeout(() => {
    notif.classList.remove("mostrar");
    setTimeout(() => {
      notif.remove();
    }, 500);
  }, 3000);
}


function notificacionCarrito(){
  mostrarNotificacion(`<i class='bi bi-check-circle'></i> Producto agregado al carrito`)
}

// Notificación exclusiva y sutil para acciones del chatbot
function mostrarNotificacionChatbot(mensaje) {
  let container = document.getElementById('notificaciones-chatbot');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notificaciones-chatbot';
    // Centrado horizontalmente, en la parte baja (pie) de la pantalla
    container.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;align-items:center;z-index:10002;pointer-events:none;';
    document.body.appendChild(container);
  }

  const notif = document.createElement('div');
  notif.classList.add('notificacion-chatbot');
  notif.style.cssText = 'background:#c60000;color:#fff;padding:10px 14px;border-radius:8px;font-size:14px;box-shadow:0 6px 18px rgba(0,0,0,0.12);opacity:0;transform:translateY(8px);transition:all .28s ease;pointer-events:auto;max-width:520px;min-width:240px;display:inline-flex;align-items:center;gap:12px;';
  // Larger chatbot icon + bolder, slightly longer message text for visibility
  notif.innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:12px;">
      <svg width="28" height="28" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="flex:0 0 28px;">
        <path d="M738.3 287.6H285.7c-59 0-106.8 47.8-106.8 106.8v303.1c0 59 47.8 106.8 106.8 106.8h81.5v111.1c0 .7.8 1.1 1.4.7l166.9-110.6 41.8-.8h117.4l43.6-.4c59 0 106.8-47.8 106.8-106.8V394.5c0-59-47.8-106.9-106.8-106.9z" fill="#fff"/>
      </svg>
      <span style="display:inline-block;vertical-align:middle;font-weight:700;">${mensaje}</span>
    </span>`;

  container.appendChild(notif);

  // Mostrar y luego ocultar suavemente
  setTimeout(() => { notif.style.opacity = '1'; notif.style.transform = 'translateY(0)'; }, 40);
  setTimeout(() => { notif.style.opacity = '0'; notif.style.transform = 'translateY(6px)'; setTimeout(() => { try{ notif.remove(); }catch(e){} }, 300); }, 3000);
}

//funcionalidad del modal para mostrar datos del usuario
document.addEventListener("DOMContentLoaded", () => {

    const API_URL = "https://backend-proyecto-distribuidora-production.up.railway.app/api/auth";

    const nombreInput = document.getElementById("nombreUsuario");
    const correoInput = document.getElementById("correoUsuario");
    const telefonoInput = document.getElementById("telefonoUsuario");
    const dniInput = document.getElementById("dniUsuario");
    const btnCambiar = document.getElementById("btnCambiarDatos");
    const btnConfirmar = document.getElementById("btnConfirmarCambios");
    const cuerpoModal = document.getElementById("cuerpoModalDatosUsuario");

    const usuario = JSON.parse(localStorage.getItem("usuario")) || [];

    function cargarDatos() {
        nombreInput.value = usuario.nombre;
        correoInput.value = usuario.correo;
        telefonoInput.value = usuario.telefono;
        dniInput.value = usuario.dni;
    }

    cargarDatos();

    btnCambiar.addEventListener("click", () => {
        btnCambiar.disabled = true;
        btnConfirmar.classList.remove("d-none");

        [nombreInput, correoInput, telefonoInput, dniInput].forEach(input => {
        input.removeAttribute("readonly");
        input.classList.add("editable");
        });
    });

    btnConfirmar.addEventListener("click",() => {
        guardarCambios();
    });

    async function guardarCambios() {
        const updatedData = {
        idUsuario: usuario.userId,
        nombre: nombreInput.value.trim(),
        correo: correoInput.value.trim(),
        telefono: telefonoInput.value.trim(),
        dni: dniInput.value.trim()
        };

        //patron para verificar si el campo telefono tiene 9 números
        const regex = /^[0-9]{9}$/;
        if(!regex.test(telefonoInput.value.trim())){
            mostrarModalMensaje("El teléfono nuevo debe tener 9 números.","error");
            return;
        }

        //patron para verificar si el campo dni tiene 8 números
        const regexDni = /^[0-9]{8}$/;
        if(!regexDni.test(dniInput.value.trim())){
            mostrarModalMensaje("El dni ingresado debe tener 8 números.","error");
            return;
        }

        try {
        const res = await fetch(`${API_URL}/actualizar`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedData)
        });

        const text = await res.text(); 
        const respuesta = JSON.parse(text);

        if (res.ok) {
            mostrarModalMensaje(respuesta.mensaje,"success");

            updatedData.userId=updatedData.idUsuario;
            delete updatedData.idUsuario;
            localStorage.setItem("usuario", JSON.stringify(updatedData));

            // Bloquear nuevamente los inputs
            [nombreInput, correoInput, telefonoInput, dniInput].forEach(input => input.setAttribute("readonly", true));
            btnCambiar.disabled = false;
            btnConfirmar.classList.add("d-none");

        } else {
            mostrarModalMensaje(respuesta.mensaje,"error");
        }

        } catch (err) {
        console.error("Error al actualizar usuario:", err);
        alert("Ocurrió un error al actualizar los datos.");
        }
    }

});


// Función para mostrar un modal de mensaje
function mostrarModalMensaje(mensaje, tipo = "info") {

  const modal = document.createElement("div");
  modal.id = "modalMensajePequeño";
  modal.className = "modal fade";
  modal.tabIndex = -1;
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-centered modal-sm">
      <div class="modal-content text-center">
        <div class="modal-header ${
          tipo === "success"
            ? "bg-success text-white"
            : tipo === "error"
            ? "bg-danger text-white"
            : "background-rojo text-white"
        } p-2">
          <h6 class="modal-title m-0">${
            tipo === "success"
              ? "Éxito"
              : tipo === "error"
              ? "Error"
              : "Aviso"
          }</h6>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body py-3">
          <p class="mb-0">${mensaje}</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const modalBootstrap = new bootstrap.Modal(modal);
  modalBootstrap.show();

  setTimeout(() => {
    modalBootstrap.hide();
    setTimeout(() => modal.remove(), 500);
  }, 3000);
}
