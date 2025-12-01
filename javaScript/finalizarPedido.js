document.addEventListener("DOMContentLoaded", () => {
  const usuario = JSON.parse(localStorage.getItem("usuario")) || [];
  const campoNombre = document.getElementById('nombreUserPedido');
  const campoCorreo = document.getElementById('emailUserPedido');
  const campoTelefono = document.getElementById('telefonoUserPedido');
  const campoDni = document.getElementById("dniUserPedido");

  campoNombre.value=usuario.nombre;
  campoCorreo.value=usuario.correo;
  campoTelefono.value=usuario.telefono;
  campoDni.value=usuario.dni;
});

/*funcionalidades de la lista de productos del pedido*/

// Función para obtener el url de la imagen de un producto
  function getImageUrl(producto) {
    return `https://backend-proyecto-distribuidora-production.up.railway.app/images/productos/${producto}.jpg`;
  }

// Funciones para manejar datos en el localStorage
function getProductosPedido() {
  return JSON.parse(localStorage.getItem("carrito")) || [];
}

function saveProductosPedido(carrito) {
  localStorage.setItem("carrito", JSON.stringify(carrito));
  actualizarBotonCarrito();
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

let totalPedidoCompra = 0;

// Array de productos del pedido
    let pedido = getProductosPedido();

    function renderProductosPedido() {
      const pedidoItems = document.getElementById("pedidoItems");
      const pedidoTotal = document.getElementById("TotalPedido");
      const descuentoPedido = document.getElementById("descuentoPedido");
      const totalPedidoNeto = document.getElementById("TotalPedidoNeto"); 

      let pedido = getProductosPedido();

      pedidoItems.innerHTML = "";
      let TotalPedido = 0;
      let descuento = 0; //se aplicará lógica de negocio para el descuento posteriormente
      let totalNeto = 0;

      pedido.forEach(producto => {
        let subtotalPedido = producto.precio * producto.cantidad;
        TotalPedido += subtotalPedido;

        let itemPedido = document.createElement("div");
        itemPedido.classList.add("cart-item");
        itemPedido.classList.add("pedido");
        itemPedido.classList.add("shadow-sm");

        itemPedido.innerHTML = `
            <div class="d-flex align-items-center">
                <a href="producto-info.html?id=${producto.id}">
                  <img src="${getImageUrl(producto.nombre)}" alt="${producto.nombre}" class="product-img-pedidoFinal me-2 ms-3" 
                  onerror="this.onerror=null; this.src='https://backend-proyecto-distribuidora-production.up.railway.app/images/default.jpg';">
                </a>
                <span class="text-truncate product-name ms-4"><a href="producto-info.html?id=${producto.id}" class="text-dark text-truncate product-name">${producto.nombre}</a></span>
            </div>
            <div class="d-flex align-items-center product-actions me-4">
                <div class="input-group input-group-sm me-1">
                    <button class="btn" onclick="cambiarCantidadPedido(${producto.id}, -1)">-</button>
                    <input type="text" class="form-control text-center cantidadProducto" value="${producto.cantidad}" readonly>
                    <button class="btn" onclick="cambiarCantidadPedido(${producto.id}, 1)">+</button>
                </div>
                <span class="text-danger fw-bold me-4">Total: S/.${parseFloat(subtotalPedido).toFixed(2)}</span>
                <button class="btn btn-remove ms-5" onclick="eliminarProductoPedido(${producto.id})">✕</button>
            </div>
        `;
        pedidoItems.appendChild(itemPedido);
      });
      totalNeto = TotalPedido-descuento;
      totalPedidoCompra = totalNeto;

      pedidoTotal.textContent = "S/." + parseFloat(TotalPedido).toFixed(2);
      descuentoPedido.textContent = "S/." + parseFloat(descuento).toFixed(2);
      totalPedidoNeto.textContent = "S/." + parseFloat(totalNeto).toFixed(2);
    }

    function cambiarCantidadPedido(id, delta) {
      let pedido = getProductosPedido();
      let productoPedido = pedido.find(p => p.id === id);
      if (!productoPedido) return;

      productoPedido.cantidad += delta;
      if (productoPedido.cantidad < 1) productoPedido.cantidad = 1;
      if (productoPedido.cantidad > productoPedido.stock){
        productoPedido.cantidad = productoPedido.stock;
        mostrarModalMensajePequeño(`Lo Sentimos, no contamos con más unidades de este producto, 
        el stock disponible es de <strong>${productoPedido.stock} Unidades.</strong>`);
      }

      saveProductosPedido(pedido);
      renderProductosPedido();
    }

    function eliminarProductoPedido(id) {
      let pedido = getProductosPedido().filter(p => p.id !== id);
      saveProductosPedido(pedido);
      renderProductosPedido();
    }
    // Render inicial
    renderProductosPedido();

/*Fin de la lista de productos */ 


/*Proceso de compra*/
const formPedido = document.getElementById('formPedido');
formPedido.addEventListener('submit', function(event) {
  event.preventDefault();
  //validamos que la compra sea mayor a S/100
  if(totalPedidoCompra<100){
    mostrarModal('¡Monto Mínimo no Alcanzado!','El monto mínimo de compra en línea es de S/.300, agregue más productos por favor.');
    return;
  }

  //validamos campos de DNI y telefono
  const ValorcampoTelefono = document.getElementById('telefonoUserPedido').value;
  const valorCampoDni = document.getElementById('dniUserPedido').value;

  const regexTelefono = /^[0-9]{9}$/;
  if(!regexTelefono.test(ValorcampoTelefono.trim())){
    mostrarModal('¡Teléfono no Válido!','El teléfono ingresado debe tener 9 números, intente nuevamente por favor.', undefined, 'telefonoUserPedido');
    return;
  }

  const regexDni = /^[0-9]{8}$/;
  if(!regexDni.test(valorCampoDni.trim())){
    mostrarModal('¡DNI no Válido!','El DNI ingresado debe tener 8 números, intente nuevamente por favor.', undefined, 'dniUserPedido');
    return;
  }

  //despúes se comprueba stock
  const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
  let productosPedido = [];

  carrito.forEach(producto => {
    productosPedido.push({
      productId: producto.id,
      cantidad: producto.cantidad
    });
  });

  verificarStock();
  
  async function verificarStock(){
    const res = await fetch("https://backend-proyecto-distribuidora-production.up.railway.app/api/pedidos/check-stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(productosPedido)
    });
    const r = await res.json();
    if (!res.ok) {
      // mostrar mensaje de que no hay stock suficiente
      const productoSinStock = r.insuficientes[0];
      mostrarModal('¡Stock Insuficiente!',`Lo sentimos, no contamos con stock suficiente 
      para el producto ${productoSinStock.nombre}, su stock actual es de ${productoSinStock.stockActual}`)
      return;
    } else {
      //si hay stock disponible se procede al proceso de pago con Culqi
      Culqi.publicKey = 'pk_test_eb16955d4d3abdf7';

      Culqi.settings({
        title: 'Mi Tienda Online',
        currency: 'PEN',
        amount: totalPedidoCompra*100  // monto en céntimos
      });

      Culqi.options({
        lang: "es",
        installments: false,
        paymentMethods: {
          tarjeta: true,
          yape: true
        },
        style: {
          logo: "https://i.imgur.com/w1UlDpY.jpeg"
        }
      });

      Culqi.open();
    }
  }

});

function culqi() {
  if (Culqi.token) {
    console.log("Token generado:", Culqi.token.id);
    //si el pago es exitoso se realiza el pedido
    realizarPedido();
    Culqi.close();
  } else if (Culqi.order) {
    console.log("Orden generada:", Culqi.order);
  } else {
    console.error("Error en pago:", Culqi.error);
    Culqi.close();
    realizarPedido();
  }
}


async function realizarPedido(){
  const region = document.getElementById('regionPedido').value;
  const provincia = document.getElementById('provinciaPedido').value;
  const distrito = document.getElementById('distritoPedido').value;
  const direccion = document.getElementById('direccionPedido').value;
  const codigoPostal = document.getElementById('codPostalPedido').value;
  const usuario = JSON.parse(localStorage.getItem("usuario")) || [];
  const nombreUsuario = usuario.nombre.trim().split(" ")[0]

  const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
  let productosPedido = [];

  carrito.forEach(producto => {
    productosPedido.push({
      productId: producto.id,
      cantidad: producto.cantidad
    });
  });

  const direccionCompleta = `${region}-${provincia}-${distrito}-${codigoPostal}-${direccion}`;

  const infoPedido = {
    "usuarioId" : usuario.userId,
    "direccion" : direccionCompleta,
    "items" : productosPedido 
  }

  const res = await fetch("https://backend-proyecto-distribuidora-production.up.railway.app/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(infoPedido)
  });
  const orderResp = await res.json();
  if (res.ok) {
    // pedido creado exitosamente
    localStorage.removeItem('carrito');
    mostrarModal('¡Pedido creado Exitosamente!',`Muchas gracias por comprar con nosotros 
      <span class="fw-bold">${nombreUsuario}</span>, el código de tu orden es PED-${orderResp.orderId.toString().padStart(3,'0')}. 
      Tu pedido llegará entre 6 a 8 días laborales.<br>
      Puedes ver tu pedido y descargar tu comprobante en la sección <a href="misPedidos.html" class="fw-bold link-danger link-offset-2 link-underline-opacity-25 link-underline-opacity-100-hover">
      "Mis Pedidos".</a>`,'index.html');
  }else {
    mostrarModal('Error al registrar el pedido', 'Lo sentimos, hubo un problema al momento de registrar el pedido, intentanlo nuevamente más tarde.');
  }

}


//obteniendo regiones, provincias y distritos de Perú
const regionSelect = document.getElementById("regionPedido");
const provinciaSelect = document.getElementById("provinciaPedido");
const distritoSelect = document.getElementById("distritoPedido");

let ubigeoData = {};

// Cargar JSON desde la API
fetch("https://free.e-api.net.pe/ubigeos.json")
  .then(res => {
    if (!res.ok) throw new Error("Error al cargar ubigeos");
    return res.json();
  })
  .then(data => {
    ubigeoData = data;

 
    Object.keys(ubigeoData).forEach(region => {
      const opt = document.createElement("option");
      opt.value = region;
      opt.textContent = region;
      regionSelect.appendChild(opt);
    });
  })
  .catch(err => console.error(err));


regionSelect.addEventListener("change", () => {
  provinciaSelect.innerHTML = '<option selected disabled>Seleccione una Provincia</option>';
  distritoSelect.innerHTML = '<option selected disabled>Seleccione un Distrito</option>';
  provinciaSelect.disabled = false;
  distritoSelect.disabled = true;

  const provincias = Object.keys(ubigeoData[regionSelect.value]);
  provincias.forEach(prov => {
    const opt = document.createElement("option");
    opt.value = prov;
    opt.textContent = prov;
    provinciaSelect.appendChild(opt);
  });
});


provinciaSelect.addEventListener("change", () => {
  distritoSelect.innerHTML = '<option selected disabled>Seleccione un Distrito</option>';
  distritoSelect.disabled = false;

  const distritos = Object.keys(ubigeoData[regionSelect.value][provinciaSelect.value]);
  distritos.forEach(dist => {
    const opt = document.createElement("option");
    opt.value = dist;
    opt.textContent = dist;
    distritoSelect.appendChild(opt);
  });
});


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

// Función para mostrar un modal de mensaje
function mostrarModalMensajePequeño(mensaje, tipo = "info") {

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
  }, 6000);
}