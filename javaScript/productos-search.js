//cargando titulo segun lo que ingreso en el buscador
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const busqueda = params.get("busqueda");

    const titulo = document.getElementById("tituloCategoria");

    titulo.innerHTML = `
        <span class="fw-bold">BÚSQUEDA //</span> ${busqueda.toUpperCase()}
    `;
});


//funciones para guardar los productos agregados al carrito en el localStorage
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
  let cantidadProductosCarrito = getCarrito().length;
  botonFlotante.textContent = cantidadProductosCarrito;
  if (cantidadProductosCarrito > 0) {
  botonFlotante.classList.add('show');
  } else {
    botonFlotante.classList.remove('show');
  }
}


function agregarAlCarrito(producto, cantidad = 1) {
  let carrito = getCarrito();

  // Verificar si ya existe en el carrito
  let existente = carrito.find(p => p.id === producto.id);

  if (existente) {
    //se verifica el stock disponible
    let cantidadTotal = existente.cantidad + cantidad; 
    if(cantidadTotal > producto.stock){
        mostrarModalMensajePequeño(`Solo contamos con <strong>${producto.stock} Unidades</strong> de este producto. Se agregó el Stock máximo disponible al carrito.`);
        existente.cantidad = producto.stock;
    }else{
        existente.cantidad += cantidad;
    }
  } else {
    if(cantidad > producto.stock){
        mostrarModalMensajePequeño(`Solo contamos con <strong>${producto.stock} Unidades</strong> de este producto. Se agregó el Stock máximo disponible al carrito.`);
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            stock: producto.stock,
            cantidad: producto.stock
        });
    }else{
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            stock: producto.stock,
            cantidad: cantidad
        });
    }
  }

  saveCarrito(carrito);
}



//cargando productos desde la base de datos
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://backend-proyecto-distribuidora-production.up.railway.app/api";
  const container = document.querySelector("#seccion-productos .row");
  let productosTotales;
  let paginaProducto = 2;

  if (!container) {
    console.error("No se encontró el contenedor de productos.");
    return;
  }

  // Obtener id de la subcategoria desde la URL
  const params = new URLSearchParams(window.location.search);
  const textoBusqueda = params.get("busqueda");

  if (!textoBusqueda) {
    container.innerHTML = "<p class='text-center text-danger'>No se realizo ninguna busqueda.</p>";
    return;
  }

  // Función para obtener el url de la imagen de un producto
  function getImageUrl(producto) {
    return `https://backend-proyecto-distribuidora-production.up.railway.app/images/productos/${producto}.jpg`;
  }

  // Traer productos por subcategoría
  async function fetchProductos() {
    try {
      const res = await fetch(`${API_BASE}/productos/search?busqueda=${textoBusqueda}`);
      if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
      const productos = await res.json();
      console.log(productos.length);
      productosTotales = productos;

      //si hay menos de 16 productos no se mostrará el boton mostrar más
      if(productosTotales.length <= 16){
        document.getElementById('botonMostrarMas').style.display= 'none';
      }

      renderProductos(productos);
    } catch (err) {
      console.error("Error cargando productos:", err);
      container.innerHTML = "<p class='text-center text-danger'>Error cargando productos.</p>";
    }
  }

  // Renderizar tarjetas de productos
  function renderProductos(productos, reiniciar = false) {

    if (productos.length === 0) {
      container.innerHTML = "<p class='text-center'>No hay productos disponibles en esta busqueda.</p>";
      return;
    }
    productos=productos.slice(0,16);//se limite los productos máximo a 16

    if(reiniciar){
      container.innerHTML=" ";
    }

    productos.forEach((p) => {
      const col = document.createElement("div");
      col.className = "col-12 col-md-6 col-lg-3";

      col.innerHTML = `
        <div class="product-card shadow">
          <a href="producto-info.html?id=${p.id}">
            <img src="${getImageUrl(p.nombre)}" alt="${p.nombre}"
              onerror="this.onerror=null; this.src='https://backend-proyecto-distribuidora-production.up.railway.app/images/default.jpg';">
          </a>
          <h6 class="mt-2 fw-bold text-danger fs-5">${p.cod}</h6>
          <p class="fs-5">${p.nombre}</p>
          <div class="product-price">S/.${parseFloat(p.precio).toFixed(2)}</div>
          <div class="qty-controls">
            <button class="btn btn-outline-danger btn-sm backgroundHover-rojo" onclick="updateQty(this, -1)">-</button>
            <input type="number" class="form-control mx-1" value="1" min="1">
            <button class="btn btn-outline-danger btn-sm backgroundHover-rojo" onclick="updateQty(this, 1)">+</button>
          </div>
          <button class="btn btn-outline-danger w-100 backgroundHover-rojo btn-add-carrito" onclick="notificacionCarrito()">Agregar al Carrito</button>
        </div>
      `;

      // evento para el botón "Agregar al carrito"
      const btn = col.querySelector(".btn-add-carrito");
      const inputQty = col.querySelector("input");

      btn.addEventListener("click", () => {
        const cantidad = parseInt(inputQty.value) || 1;
        agregarAlCarrito(p, cantidad);
        inputQty.value=1;
      });

      container.appendChild(col);
    });
  }

  //funciones para la paginación
  function obtenerBloque(productos, pagina) {
    const inicio = (pagina - 1) * 16;
    const fin = inicio + 16;
    return productos.slice(inicio, fin);
  }

  function mostrarSiguienteBloque(){
    const botonPaginacion = document.getElementById('botonMostrarMas');
    const paginasTotales = Math.ceil(productosTotales.length/16);
    if(paginaProducto <= paginasTotales){
      const productosBloqueActual = obtenerBloque(productosTotales, paginaProducto);
      renderProductos(productosBloqueActual);
    }
    
    //se cambia el contenido del boton cuando se llega a la última página
    if(paginaProducto == paginasTotales){
      botonPaginacion.innerHTML = 'Mostrar Menos <i class="bi bi-chevron-double-up"></i>'; 
    }

    //se vuelven a mostrar solo los primeros productos
    if(paginaProducto > paginasTotales){
      renderProductos(productosTotales, true);
      botonPaginacion.innerHTML = 'Mostrar Más <i class="bi bi-chevron-double-down"></i>';
      window.scrollTo({ top: 2180, behavior: "smooth" }); 
      paginaProducto = 2;
      return;
    }

    paginaProducto += 1;

  }

  const botonPaginacion = document.getElementById('botonMostrarMas');
  botonPaginacion.addEventListener('click', function() {
    mostrarSiguienteBloque();
  });

  // Cargar productos
  fetchProductos();
});

// Función para mostrar un pequeño mensaje
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
  }, 8000);
}