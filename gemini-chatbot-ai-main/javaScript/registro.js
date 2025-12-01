const formularioRegistro = document.getElementById('formRegistro');
formularioRegistro.addEventListener('submit', function(event) {
    event.preventDefault();
    submitRegister();
});


async function submitRegister() {

    //patron para verificar si el campo telefono tiene 9 números
    const regex = /^[0-9]{9}$/;
    if(!regex.test(document.getElementById('telefono').value.trim())){
        mostrarModal('¡Teléfono no Válido!','El teléfono ingresado debe tener 9 números, intente nuevamente por favor.', undefined, 'telefono');
        return;
    }

    //patron para verificar si el campo dni tiene 8 números
    const regexDni = /^[0-9]{8}$/;
    if(!regexDni.test(document.getElementById('dni').value.trim())){
        mostrarModal('DNI no Válido!','El DNI ingresado debe tener 8 números, intente nuevamente por favor.', undefined, 'dni');
        return;
    }

    //confirmacion de telefono y contraseña
    if(document.getElementById('telefono').value.trim() != document.getElementById('telefonoConfirmacion').value.trim()){
        mostrarModal('¡Teléfono no Válido!','Los campos del teléfono no coinciden, intente nuevamente por favor.', undefined, 'telefonoConfirmacion');
        document.getElementById('telefonoConfirmacion').value='';
        return;
    }

    if(document.getElementById('password').value.trim().length<6){
        mostrarModal('Contraseña no Válida!','La contraseña debe tener al menos 6 caracteres, intente nuevamente por favor.', undefined, 'password');
        return;
    }

    if(document.getElementById('password').value.trim() != document.getElementById('passwordConfirmacion').value.trim()){
        mostrarModal('Contraseña no Válida!','Los campos de la contraseña no coinciden, intente nuevamente por favor.', undefined, 'passwordConfirmacion');
        document.getElementById('passwordConfirmacion').value='';
        return;
    }

    const datosRegistro = {
        nombre: document.querySelector("#nombre").value.trim(),
        telefono: document.querySelector("#telefono").value.trim(),
        correo: document.querySelector("#correo").value.trim(),
        dni: document.querySelector("#dni").value.trim(),
        contrasena: document.querySelector("#password").value.trim()
    };

    const res = await fetch("https://backend-proyecto-distribuidora-production.up.railway.app/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datosRegistro)
    });

    const data = await res.json();
    if (!res.ok) {
        mostrarModal('¡Error al intentar Registrarte!',data.message);
        return;
    }
    delete data.message;
    delete data.token;
    //guardando datos del usuario
    localStorage.setItem("usuario", JSON.stringify(data));
    const primerNombreUsuario = data.nombre.trim().split(" ")[0];

     mostrarModal('¡Registro de Usuario Exitoso!',`Gracias por unirte a nosotros <span class="fw-bold">${primerNombreUsuario}</span>, ya puedes navegar por nuestro sitio web y realizar tus pedidos por línea`, 'index.html');
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
