const formularioCambio = document.getElementById('formCambio');
formularioCambio.addEventListener('submit', function(event) {
    event.preventDefault();
    submitform();
});

async function submitform() {
    //verificando la clave nueva del usuario
    if(document.getElementById('claveNueva').value.trim().length<6){
        mostrarModal('Contraseña no Válida!','La contraseña nueva debe tener al menos 6 caracteres, intente nuevamente por favor.', undefined, 'claveNueva');
        return;
    }

    if(document.getElementById('claveNueva').value.trim() != document.getElementById('claveNuevaConfirmacion').value.trim()){
        mostrarModal('Contraseña no Coincide!','Los campos de la contraseña no coinciden, intente nuevamente por favor.', undefined, 'claveNuevaConfirmacion');
        document.getElementById('claveNuevaConfirmacion').value='';
        return;
    }

    const data = {
        email: document.getElementById('correo').value.trim(),
        oldPassword: document.getElementById('claveActual').value.trim(),
        newPassword: document.getElementById('claveNueva').value.trim()
    };

    try {
        const res = await fetch('https://backend-proyecto-distribuidora-production.up.railway.app/api/auth/cambiar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
        });

        const text = await res.text(); 
        const respuesta = JSON.parse(text);
        if(res.ok){
            mostrarModal('Cambio de Contraseña Exitoso!','Su contraseña se actualizo correctamente.','index.html');
        }else{
            mostrarModal('Error al Intentar el Cambio!',respuesta.mensaje);
        }

    } catch (error) {
        console.error(error);
        console.log('error al conectar con el servidor');
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