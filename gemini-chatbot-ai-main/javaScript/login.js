const formularioLogin = document.getElementById('formLogin');
formularioLogin.addEventListener('submit', function(event) {
    event.preventDefault();
    submitLogin();
});

async function submitLogin() {
  const datosLogin = {
    correo: document.querySelector("#loginCorreo").value.trim(),
    contrasena: document.querySelector("#loginPassword").value.trim()
  };

  const res = await fetch("https://backend-proyecto-distribuidora-production.up.railway.app/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datosLogin)
  });

  const data = await res.json();
  if (res.status === 200) {
    delete data.message;
    delete data.token;
    const primerNombreUsuario = data.nombre.trim().split(" ")[0];
    localStorage.setItem("usuario", JSON.stringify(data));
    mostrarModal('¡Inicio de Sesión Exitoso!',`Gracias por unirte a nosotros <span class="fw-bold">${primerNombreUsuario}</span>, ya puedes navegar por nuestro sitio web y realizar tus pedidos por línea`, 'index.html');
  } else {
    mostrarModal('¡Error al intentar iniciar Sesión!',data.message, undefined, 'loginCorreo');
  }
}


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