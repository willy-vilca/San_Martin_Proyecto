import express from "express";
import cors from "cors";
import pkg from "pg";
import { LocalStorage } from 'node-localstorage';
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from 'path';
import { fileURLToPath } from 'url';
const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let client = null;
let clientConnected = false;

const DB_CONFIG = {
  host: process.env.DB_HOST || null,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  user: process.env.DB_USER || null,
  password: process.env.DB_PASS || null,
  database: process.env.DB_NAME || null,
};

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
let genAI = null;
let model = null;
// Enforce DB-only behavior when set. If true and DB is not connected, handler will inform the caller.
const FORCE_DB_ONLY = process.env.FORCE_DB_ONLY === 'true';

function ensureModel() {
  if (model) return true;
  if (!GOOGLE_API_KEY) return false;
  try {
    genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    return true;
  } catch (e) {
    console.warn('No se pudo inicializar el modelo generativo:', e.message);
    model = null;
    return false;
  }
}



// Al inicio de tu archivo, después de los imports
const chatHistory = {};      // Aquí se guardarán los mensajes por usuario
const MAX_MEMORY = 10;       // Número máximo de mensajes por usuario que quieres conservar

let userIntent = '';





// ===== CHAT =====
app.post('/chat', async (req,res)=>{


  
  const { prompt, userId } = req.body || {};
  const userKey = userId || req.ip || 'anonymous';
  const texto = prompt;
  // If the system is configured to FORCE DB-only and DB is not connected, inform caller
  if (FORCE_DB_ONLY && !clientConnected) {
    return res.json({ answer: 'El chatbot está configurado para usar únicamente el catálogo (FORCE_DB_ONLY=true), pero la base de datos no está conectada. Por favor, activa la BD o desactiva FORCE_DB_ONLY.' });
  }
  if (!texto) {
    return res.json({
      answer: '👋 ¡Hola! Soy tu asistente de compras 😊\nDime qué producto buscas o para qué lo necesitas y te mostraré las mejores opciones.'
    });
  }



  try {
    
        function ensureUserHistory(userKey) {
          if (!chatHistory[userKey]) {
            chatHistory[userKey] = [];
          }
        }
        

        // ===== FALLBACK FINAL: IA =====
        if (!model && GOOGLE_API_KEY) {



          
          try {
            genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
            model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            console.log("🤖 Modelo Gemini inicializado correctamente");
          } catch (e) {
            console.warn("⚠️ Error al iniciar Gemini:", e.message);
            model = null;
          }
        }

        if (!model) {
          return res.json({
            answer:
              "No puedo generar sugerencias inteligentes ahora 😔. Pero puedo mostrarte el catálogo disponible 🛍️. ¿Quieres verlo?"
          });
        }
          ensureUserHistory(userKey); // ✅ Crea el historial si no existe

        try {
          // === Consultar productos desde la BD si está disponible ===
          let iaPrompt = ``;
          let productos = [];
          let catalogoTexto = '';
          // Variables para manejar búsqueda por palabra clave
          let palabraClave = null;
          let palabraClaveNoMatch = false;
          if (clientConnected && client) {
            const ultimaSolicitud = prompt;
            let resultado = null;

            // === Priorizar búsqueda por palabra clave extraída ===
            try {
              palabraClave = await extraerPalabraClave(model, ultimaSolicitud);
              console.log(`🔎 Palabra clave detectada: ${palabraClave}`);
              if (palabraClave) {
                const ver = await verificarSiEsProducto(client, palabraClave);
                if (ver === palabraClave) {
                  resultado = ver;
                  userIntent = palabraClave;
                  console.log(`🎯 Intención detectada por palabra clave: ${userIntent}`);
                } else {
                  // Marcamos que no se encontró producto exacto para la palabra clave
                  palabraClaveNoMatch = true;
                }
              }
            } catch (e) {
              console.warn('⚠️ Falló extracción de palabra clave, continuando con interpretación:', e.message);
            }

            // Si no se encontró producto por palabra clave, usar interpretación completa
            if (!resultado || resultado === 'No es producto') {
              // === Interpretar intención del usuario con Gemini ===
              userIntent = await interpretarIntencion(model, ultimaSolicitud);
              console.log(`🎯 Intención detectada: ${userIntent}`);
              if (userIntent !== "detalle" && userIntent !== "saludo" && userIntent !== "registro" && userIntent !== "pago" && userIntent !== "comprar" && userIntent !== "sugerir") {
                resultado = await verificarSiEsProducto(client,userIntent);
              }
            }

            //-------verifica si la intencion simplificada (palabra clave) es un producto existente en la base de datos
              if (resultado === userIntent && userIntent !== "detalle" && resultado !== "detalle" && userIntent !== "saludo" && userIntent !== "registro" && userIntent !== "pago" && userIntent !== "comprar") {
                  try {
                  const searchQuery =  `
                    SELECT 
                      p.id_producto,
                      p.nombre, 
                      p.descripcion, 
                      p.precio,
                      p.stock,
                      s.nombre AS subcategoria
                    FROM productos p
                    LEFT JOIN subcategoria s 
                      ON p.id_subcategoria = s.id_subcategoria
                    WHERE LOWER(p.nombre) LIKE LOWER($1)
                      OR LOWER(p.descripcion) LIKE LOWER($1)
                      OR LOWER(s.nombre) LIKE LOWER($1);
                  `;
                  const userSearch = `%${resultado}%`;
                  const dbResult = await client.query(searchQuery, [userSearch]);
                  productos = dbResult.rows;

                  console.log(`🛒 ${productos.length} productos encontrados para "${resultado}"`);
                  
                } catch (err) {
                  console.error("⚠️ Error al buscar productos:", err.message);
                }

                // === Formatear los productos ===
                catalogoTexto = productos.length > 0
                  ? productos.map(p => `• ${p.nombre} – ${p.descripcion} – ${p.stock} – ${p.subcategoria} (S/ ${p.precio})`).join('\n')
                  : 'No se encontraron coincidencias exactas en el catálogo actual.';



              

                // === Armar prompt completo ===
                iaPrompt = `
                  Eres un chatbot, muestra un listado de productos basado en la siguiente solicitud del cliente.
                  Luego muestra una lista con los productos relacionados que tienes en el catálogo.
                  Se amigable y visualmente atractivo.
                  Usa emojis para hacerlo más atractivo y amigable se lo mas amigable posible.
                  Mensaje actual del cliente: "${prompt}"
                  Productos relacionados disponibles en el catálogo:
                  ${catalogoTexto}
                  Utiliza el nombre tal cual y el precio de cada producto.
                  No digas nada adicional solo enumera de la siguiente manera

                  1. Nombre del producto – S/ precio
                  2. Nombre del producto – S/ precio
                  3. Nombre del producto – S/ precio
                  
                  SOLO EL NOMBRE DEL PRODUCTO Y SU PRECIO NADA MAS, NO DESCRIPCION NI NADA EXTRA

                  ¿Cuál de estos productos te interesa o deseas más detalles sobre alguno en particular?

                `;
                
                }
              
                if(userIntent == "detalle" || userIntent == "comprar" && userIntent !== "saludo" && userIntent !== "registro" && userIntent !== "pago"){
                  // Obtener el último mensaje del asistente
                  const historial = chatHistory[userKey];
                  const ultimoMensajeIAObj = [...historial].reverse().find(msg => msg.role === 'assistant');
                  const ultimoMensajeIA = ultimoMensajeIAObj ? ultimoMensajeIAObj.text : '';

                  

                  const idProducto = await detectarProductoElegido(model, client, ultimoMensajeIA, prompt);
                  if (idProducto !== "No es producto" && idProducto !== "Error al detectar producto") {
                    console.log(`Ultimo mensaje enviado por la IA ${ultimoMensajeIA}`);
                    const detalleMensaje = await mostrarDetallesProducto(model, client, idProducto);
                    // === Actualizar memoria ===
                  chatHistory[userKey].push({ role: 'user', text: prompt });
                  chatHistory[userKey].push({ role: 'assistant', text: detalleMensaje });
                  if (chatHistory[userKey].length > MAX_MEMORY * 2) {
                    chatHistory[userKey] = chatHistory[userKey].slice(-MAX_MEMORY * 2);
                  }

                    return res.json({ answer: detalleMensaje, intent: userIntent });

                    
                  } else {
                    return res.json({ answer: "Lo siento, no pude identificar el producto que mencionaste. ¿Podrías ser más específico?", intent: userIntent });
                }
              } 

              if(userIntent === "sugerir" || resultado == "No es producto" && userIntent !== "saludo"&& userIntent !== "registro" && userIntent !== "pago" && userIntent !== "comprar"){
                  // Obtener el último mensaje del usuario
                  const mensajeGracioso = await sugerirProducto(model, client, prompt);
                  // === Actualizar memoria ===
                  chatHistory[userKey].push({ role: 'user', text: prompt });
                  chatHistory[userKey].push({ role: 'assistant', text: mensajeGracioso });
                  if (chatHistory[userKey].length > MAX_MEMORY * 2) {
                    chatHistory[userKey] = chatHistory[userKey].slice(-MAX_MEMORY * 2);
                  }

                  if (mensajeGracioso) {
                    return res.json({ answer: mensajeGracioso, intent: userIntent });
                    
                  } else {
                    return res.json({ answer: "Lo siento no pude generar una sugerencia en este momento.", intent: userIntent });
                }
                
              } 

              if(userIntent=="saludo"){
                return res.json({ answer: "¡Hola! 👋 Soy tu asistente de compras 😊. Dime qué producto buscas o para qué lo necesitas y te mostraré las mejores opciones.", intent: userIntent });
              }
              if(userIntent=="registro"){
                const link2 = `https://willy-vilca.github.io/FrontEnd-Proyecto-Distribuidora/registro.html`;
                return res.json({ answer: `Si quieres registrarte en la página, solo haz clic en este enlace y completa tus datos. ¡Es rapidísimo! 😊\n${link2}`, intent: userIntent });
              }

              if(userIntent=="pago" || userIntent=="comprar"){
                const link3 = `https://willy-vilca.github.io/FrontEnd-Proyecto-Distribuidora/finalizarPedido.html`;
                return res.json({ answer: `¡Perfecto! Para confirmar tu pedido solo haz clic en el siguiente enlace y finaliza el proceso. 🚀\n${link3}\n<strong>⚠️ Recuerda que la compra mínima es de S/.100!</strong>`, intent: userIntent });
              }
          }



              // === Generar respuesta con Gemini ===
              if (!ensureModel())
                return res.json({ answer: 'No puedo generar sugerencias inteligentes ahora 😔. Pero puedo mostrarte el catálogo disponible 🛍️. ¿Quieres verlo?' });

              const iaResp = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: iaPrompt }] }]
              });

              let aiText = iaResp?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
                "No pude procesar tu solicitud, pero puedo mostrarte el catálogo disponible 🛍️.";

              aiText = aiText.replace(/\[.*?\]/g, "").trim();

              // Si inicialmente buscamos por palabra clave y no se encontró
              // un producto exacto, pero después hallamos productos relacionados,
              // avisamos al usuario según lo solicitado.
              if (palabraClaveNoMatch && productos && productos.length > 0) {
                aiText = `No se encontró el producto específico para "${palabraClave}", pero encontramos productos relacionados en el listado:\n\n` + aiText;
              }

              // === Actualizar memoria ===
              aiText = aiText || "No pude procesar tu solicitud.";
              chatHistory[userKey].push({ role: 'user', text: prompt });
              chatHistory[userKey].push({ role: 'assistant', text: aiText });
              if (chatHistory[userKey].length > MAX_MEMORY * 2) {
                chatHistory[userKey] = chatHistory[userKey].slice(-MAX_MEMORY * 2);
              }

              // === Enviar respuesta final ===
              // Si tenemos productos provenientes de la búsqueda en BD, inclúyelos de forma estructurada
              let responseProducts = undefined;
              if (productos && productos.length) {
                responseProducts = productos.map(p => ({
                  id: p.id_producto || null,
                  nombre: p.nombre,
                  descripcion: p.descripcion,
                  precio: p.precio,
                  stock: typeof p.stock !== 'undefined' ? Number(p.stock) : null,
                  subcategoria: p.subcategoria || null
                }));
              }

              return res.json({ answer: aiText, intent: userIntent, products: responseProducts });

            } catch (err) {
              console.error("💥 Error al generar sugerencia inteligente:", err);
              return res.status(500).json({
                error: "Ocurrió un error al generar la respuesta con IA.",
                detail: err.message
              });
            }








            
          } catch(e){
            console.error('Error en /chat:', e);
            res.status(500).json({ error: 'Falla en el servidor' });
          }
        });

        app.use((err, req, res, next) => {
          console.error("Error global:", err);
          res.status(500).json({ error: "Error interno del servidor" });
        });



        // ===== metodo para inciar SERVIDOR =====
        async function startServer() {
          if (DB_CONFIG.host && DB_CONFIG.user && DB_CONFIG.password && DB_CONFIG.database) {
            const useSsl = process.env.DB_SSL === 'true' || (DB_CONFIG.host && DB_CONFIG.host.includes('supabase'));
            const clientOpts = { ...DB_CONFIG };
            if (useSsl) clientOpts.ssl = { rejectUnauthorized:false };
            client = new Client(clientOpts);
            try { await client.connect(); clientConnected = true; console.log('✅ Conectado a la base de datos'); }
            catch(e){ clientConnected = false; console.warn('⚠️ No se pudo conectar a DB:', e.message); }
          } else { console.warn('⚠️ No hay configuración de DB, usar fallback.'); }

          const port = process.env.PORT ? Number(process.env.PORT) : 3000;
          const server = app.listen(port,()=>console.log(`✅ Servidor listo → http://localhost:${port}`));

          const shutdown = async ()=>{ 
            console.log('⏳ Cerrando servidor...'); 
            server.close(); 
            if(clientConnected && client) try{ await client.end(); console.log('🔌 DB cerrada'); }catch(e){console.warn(e);} 
            process.exit(0); 
          };
          process.on('SIGINT', shutdown);
          process.on('SIGTERM', shutdown);
        }


  //metodo para interpretar mensaje del usuario y extraer la intencion principal
        async function interpretarIntencion(model, mensajeUsuario) {
          const promptIntencion = `
        Analiza el siguiente mensaje y responde SOLO con una palabra o frase corta
        que represente la intención o producto principal buscado.

        Ejemplos:
        - "quiero auriculares para escuchar música" → "auriculares"
        - "tienes algo para cocinar arroz" → "olla"
        - "busco bebidas frías" → "bebidas"
        - "necesito una receta con atún" → "receta con atún"
        - "me gustaría comprar un reloj elegante" → "reloj"
        - "dame opciones de zapatillas para correr" → "zapatillas deportivas"
        - "busco un cargador para mi celular" → "cargador"
        - "quiero algo para limpiar mi casa" → "artículos de limpieza"
        - "quiero algo para cepillarme los dientes" → "cepillo"
        - "necesito un mouse para mi computadora" → "mouse"
        - "busco un teclado para mi pc" → "teclado"
        - "busco un parlante bluetooth" → "parlante"
        - "quiero algo para peinarme el cabello" → "peine"
        - "quiero algo para prepara algo en un horno o para usar como utencilio y hacer un postro" → "repostería"
        - "busco maquillaje para una fiesta" → "maquillaje"
        - "necesito un inflador para mi bicicleta" → "inflador"
        - "quiero algo para organizar mis papeles" → "carpeta"
        - "busco un peluche para regalar" → "peluche"
        - "quiero algo para decorar mi sala" → "decoración"
        - "busco para oler rico" → "colonias"
        - "busco unos zapatos elegantes" → "zapatos"
        - "quiero algo para escuchar musica en mi casa a alto volumen" → "parlantes"
        - "necesito un candado para asegurar mi bicicleta" → "candados"
        - "necesito baterías para mi control remoto" → "pilas"
        - "necesito donde poner mis plantas" → "macetas"
        - "quiero algo para poder mis flores" → "floreros"
        - "busco algo para pasar el aburrimieto armando cosas" → "rompecabezas"
        - "busco algo adherir con cinta " → "adhesivos"
        - "busco algo para jugar " → "pelota o rompecabezas o peluche" cualquiera es valido
        - "tienes algo para cocinar de cena o para poder comer luego" → "refrigerados"
        - "tienes algo para cocinar de almuerzo o para poder comer luego" → "conservas"
        - "tienes algo para cocinar de desayuno para poder comer luego" → "lacteos"
        - "tiens algo que pueda usar en el baño" → "accesorios de baño"
        - "tienes algo que pueda usar para limpiar mi casa" → "artículos de limpieza"
        - "quiero algo para poder caminar en mi dia a dia" → "zapatillas casuales"
        - "quiero los mejores audífonos que tengas" → "audífonos premium"
        - Si el cliente pregunta por el detalle de un producto o quiere indagar mas en uno espeficico→ "detalle"
        - Si el cliente quiere comprar un producto específico → "comprar"
        - Si el cliente te saluda dice buenas tardes → "saludo"
        - Importante si el cliente quiere comprar un producto específico y menciona el nombre exacto del producto responde exactamente con el nombre del producto tal cual ccomo indico
        -Si el cliente dice que quiere comprar algo pero no sabe que -> "sugerir"
        -Si el cliente pregunta algo que no tiene nada que ver con productos o compras, ya sea preguntas generales, cuentos,historias,chistes → "sugerir"


        estas son las subcategorias disponibles:
        Auriculares
        Accesorios de Cocina
        Cables
        Cargadores/Adaptadores
        Otros
        Ollas y Sartenes
        Vasos y Tazas
        Platos
        Repostería
        Maquillaje
        Peines y Cepillos
        Cremas Corporales
        Accesorios Higiénicos
        Colonias
        Zapatos
        Zapatillas Deportivas
        Zapatillas Casuales
        Pilas
        Teclados/Mouse
        Parlantes
        Herramientas
        Candados
        Infladores
        Conservas
        Lácteos
        Refrigerados
        Decoración
        Floreros
        Macetas
        Pelotas
        Peluches
        Rompecabezas
        Adhesivos
        Carpetas
        Cuadernos
        Accesorios de baño
        Artículos de limpieza
        Baldes
        Relojes
        Organizadores
        Estos son las subcategorias disponibles en el catálogo, si el cliente menciona alguna de estas palabras responde exactamente con esa palabra.

          Auriculares
          Accesorios de Cocina
          Cables
          Cargadores/Adaptadores
          Otros
          Ollas y Sartenes
          Vasos y Tazas
          Platos
          Repostería
          Maquillaje
          Peines y Cepillos
          Cremas Corporales
          Accesorios Higiénicos
          Colonias
          Zapatos
          Zapatillas Deportivas
          Zapatillas Casuales
          Pilas
          Teclados/Mouse
          Parlantes
          Herramientas
          Candados
          Infladores
          Conservas
          Lácteos
          Refrigerados
          Decoración
          Floreros
          Macetas
          Pelotas
          Peluches
          Rompecabezas
          Adhesivos
          Carpetas
          Cuadernos
          Accesorios de baño
          Artículos de limpieza
          Baldes
          Relojes
          Organizadores
          Alfombras


        Recuerda:
        Si el cliente dice algo en especifico como quiero comprar un producto X responde extamente ese producto X
        Si el cliente dice algo como dame el primero, el segundo, el mas barato o el premium responde detalle solamente con la palabra "detalle"
        SI el cliente dice algo referente a como registrarse en la pagina o sobre registro -> responde "registro"
        Si el cliente dice algo referente a pagar o comprar o terminar de completar el proceso de pago -> responde "pago" o "comprar"
        No des contexto, ni explicación. Solo responde con la palabra más representativa.

        Mensaje del usuario: "${mensajeUsuario}"
        `;

          try {
            const respuesta = await model.generateContent({
              contents: [{ role: "user", parts: [{ text: promptIntencion }] }],
            });

            const textoInterpretado =
              respuesta?.response?.candidates?.[0]?.content?.parts?.[0]?.text
                ?.trim()
                ?.toLowerCase() || mensajeUsuario.toLowerCase();

            console.log(`🎯 Intención detectada: "${textoInterpretado}"`);
            return textoInterpretado;
          } catch (err) {
            console.error("⚠️ Error interpretando intención:", err.message);
            return mensajeUsuario.toLowerCase();
          }
  }

  //metodo que identifica si la intencion es un producto disponible
  async function verificarSiEsProducto(client, texto) {
    try {
      if (!client || !client._connected) {
        console.warn("⚠️ Cliente de base de datos no conectado.");
        return "No es producto";
      }

      // Buscar en la base de datos coincidencias
      const query = `
        SELECT 
          p.nombre, 
          p.descripcion, 
          p.precio,
          s.nombre AS subcategoria
        FROM productos p
        LEFT JOIN subcategoria s 
          ON p.id_subcategoria = s.id_subcategoria
        WHERE LOWER(p.nombre) LIKE LOWER($1)
          OR LOWER(p.descripcion) LIKE LOWER($1)
          OR LOWER(s.nombre) LIKE LOWER($1);
      `;

      const result = await client.query(query, [`%${texto.toLowerCase()}%`]);

      if (result.rows.length > 0) {
        console.log(`✅ "${texto}" identificado como producto existente.`);
        return texto;
      } else {
        console.log(`❌ "${texto}" no está en la base de datos.`);
        return "No es producto";
      }
    } catch (err) {
      console.error("💥 Error verificando producto:", err.message);
      return "No es producto";
    }
  }

  //Método para detectar qué producto eligió el cliente y obtener su ID real en la base de datos
  async function detectarProductoElegido(model, client, ultimoMensajeIA, mensajeCliente) {
    try {
      // 1️⃣ Construir prompt inteligente
      const promptDeteccion = `
            Eres un asistente que analiza una conversación entre un cliente y un vendedor.
            Tu tarea es identificar QUÉ PRODUCTO el cliente eligió o mencionó explícitamente
            en su respuesta, basándote en el mensaje anterior (del vendedor es decir tu) y el mensaje actual del cliente.

            Reglas:
            - Si el cliente dice algo como “quiero el primero”, “el de arriba”, “el más barato”,
              usa el mensaje anterior (del vendedor) para deducir cuál producto es.
            - Si menciona el nombre directamente, devuelve ese nombre.
            - NO des contexto, ni explicaciones. Solo responde con el NOMBRE EXACTO del producto.

            Ejemplos:
            Tenemos **Pollo entero envasado a vacio – Pollo fresco conservado al vacío (S/ 34.90)**. ¡Perfecto para una comida deliciosa y saludable! 🍗

            Para complementar tu compra, ¿qué tal si agregamos algo más a tu carrito? Podrías considerar:

            * **Java de huevos la calera – Huevo fresco de granja (S/ 18.90)**: ¡Ideales para un desayuno nutritivo o para preparar postres increíbles! 🍳
            * **Mantequilla laive de 180 g – Mantequilla cremosa de calidad (S/ 12.50)**: ¡Para darle un toque especial a tus comidas! 🧈

            si el producto esta entre dos astericos automaticamente es el nombre del producto
            si logras indentificar el producto, responde SOLO con su NOMBRE EXACTO , nada mas solo eso 
            solo responde con el nombre del producto sin lo que sigue del guio medio (–)
            si no logras identificar el producto, responde "Producto no identificado"

            Último mensaje del vendedor:
            ${ultimoMensajeIA}

            Mensaje del cliente:
            ${mensajeCliente}
            `;

      // 2️⃣ Enviar a Gemini para que deduzca el producto
      const respuesta = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: promptDeteccion }] }],
      });

      const productoDetectado =
        respuesta?.response?.candidates?.[0]?.content?.parts?.[0]?.text
          ?.trim()
          ?.toLowerCase();

      if (!productoDetectado) {
        console.log("❌ No se pudo detectar producto.");
        return "No es producto";
      }

      console.log(`🎯 Producto elegido detectado: "${productoDetectado}"`);

      // 3️⃣ Buscar producto en la base de datos
      const query = `
        SELECT id_producto, nombre
        FROM productos
        WHERE LOWER(nombre) LIKE LOWER($1)
        LIMIT 1;
      `;
      const result = await client.query(query, [`%${productoDetectado}%`]);

      // 4️⃣ Retornar el ID si existe
      if (result.rows.length > 0) {
        const producto = result.rows[0];
        console.log(`✅ Producto encontrado: ${producto.nombre} (ID: ${producto.id_producto})`);
        return producto.id_producto;
      } else {
        console.log(`❌ "${productoDetectado}" no es un producto registrado.`);
        return "No es producto";
      }

    } catch (err) {
      console.error("⚠️ Error detectando producto elegido:", err.message);
      return "Error al detectar producto";
    }
  }


  //mensaje para incentivar al cliente en comprar un producto si pidio detalle de uno
  async function mostrarDetallesProducto(model, client, idProducto) {
    try {
      // 1️⃣ Buscar producto en la base de datos
      const query = `
        SELECT nombre, descripcion, precio
        FROM productos
        WHERE id_producto = $1;
      `;
      const result = await client.query(query, [idProducto]);

      if (result.rows.length === 0) {
        console.log("❌ Producto no encontrado.");
        return "Lo siento, no encontré información sobre ese producto.";
      }

      const producto = result.rows[0];
      console.log(`✅ Producto encontrado: ${producto.nombre} (S/ ${producto.precio})`);

      // 2️⃣ Crear prompt para que la IA genere un mensaje atractivo
      const promptIncentivo = `

      El cliente acaba de escoger este producto y quiere más detalles para decidirse a comprarlo.
    Eres un asistente de ventas amable y persuasivo. Tu tarea es crear un mensaje corto, encantador y convincente
    para incentivar al cliente a comprar el siguiente producto, resaltando su precio y características sin sonar robótico.

  Producto:
  Nombre: ${producto.nombre}
  Descripción: ${producto.descripcion}
  Precio: S/ ${producto.precio}

  Reglas:
  - Usa tono natural, amigable y emocional.
  - No des información inventada.
  - Termina invitando al cliente a concretar la compra.
  - Usa emojis para hacerlo más atractivo.

  Ejemplo:
  “Estos auriculares son una maravilla: sonido limpio, buena batería y sin enredos de cables. Perfectos para el gym, viajes o relajarte. A este precio, te llevas comodidad y estilo en un solo paquete. Créeme, te van a encantar.”
  “Estas zapatillas combinan comodidad, diseño y resistencia. Ideales para entrenar o salir casual. No solo se ven bien, se sienten bien. Y con este precio, estás haciendo una compra inteligente. Si las pruebas, te quedas con ellas.”
  Genera solo el mensaje:
  `;

      // 3️⃣ Generar el mensaje con la IA
      const respuesta = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: promptIncentivo }] }],
      });

      let mensajeIA =
        respuesta?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        `Tenemos el producto "${producto.nombre}" a S/ ${producto.precio}. ¡Aprovecha esta gran oportunidad!`;

      // 4️⃣ Retornar el mensaje final
      console.log(`💬 Mensaje generado: ${mensajeIA}`);
      //contruir link del producto
            let link = `https://willy-vilca.github.io/FrontEnd-Proyecto-Distribuidora/producto-info.html?id=${idProducto}`;
      // Construir URL de imagen
      const baseImg = "https://backend-proyecto-distribuidora-production.up.railway.app/images/productos/";
      const encodedName = encodeURIComponent(producto.nombre.trim());
      const imageUrl = `${baseImg}${encodedName}.jpg`;
      const safeImage = producto.nombre && producto.nombre.length > 0 ? imageUrl : `${baseImg}default.jpg`;

      mensajeIA += `\n${safeImage}\n`;
      mensajeIA += `\n🛒 Compra aquí: \n${link}`;

      return mensajeIA;

    } catch (err) {
      console.error("⚠️ Error mostrando detalles del producto:", err.message);
      return "Ocurrió un error al mostrar el detalle del producto.";
    }
  }

//  Método para responder con humor usando un producto aleatorio de la base de datos
async function sugerirProducto(model, client, mensajeCliente) {
  try {
    // Intentar encontrar producto relacionado por palabra clave extraída
    let producto = null;
    let relatedFound = false;

    if (client && client._connected) {
      try {
        const palabra = await extraerPalabraClave(model, mensajeCliente);
        if (palabra) {
          const queryRel = `
            SELECT id_producto, nombre, descripcion, precio
            FROM productos
            WHERE LOWER(nombre) LIKE LOWER($1)
              OR LOWER(descripcion) LIKE LOWER($1)
            LIMIT 1;
          `;
          const resRel = await client.query(queryRel, [`%${palabra}%`]);
          if (resRel.rows.length > 0) {
            producto = resRel.rows[0];
            relatedFound = true;
            console.log(`🔎 Producto relacionado encontrado para "${palabra}": ${producto.nombre}`);
          }
        }
      } catch (e) {
        console.warn('⚠️ Error buscando producto relacionado:', e.message);
      }
    }

    // Si no hay producto relacionado, elegir uno aleatorio (sugerencia general)
    if (!producto) {
      if (!client || !client._connected) {
        console.warn('⚠️ Cliente de base de datos no conectado, no puedo seleccionar producto.');
        return 'Lo siento, no puedo acceder al catálogo ahora mismo para hacer una sugerencia.';
      }
      const query = `
        SELECT id_producto, nombre, descripcion, precio
        FROM productos
        ORDER BY RANDOM()
        LIMIT 1;
      `;
      const result = await client.query(query);
      if (result.rows.length === 0) {
        console.log("⚠️ No hay productos en la base de datos.");
        return "Lo siento, no tengo productos para recomendar en este momento.";
      }
      producto = result.rows[0];
      console.log(`🎲 Producto aleatorio seleccionado: ${producto.nombre}`);
    }

    // Construir URL de imagen y link de compra
    const baseImg = "https://backend-proyecto-distribuidora-production.up.railway.app/images/productos/";
    const encodedName = encodeURIComponent(producto.nombre.trim());
    const imageUrl = `${baseImg}${encodedName}.jpg`;
    const safeImage = producto.nombre && producto.nombre.length > 0 ? imageUrl : `${baseImg}default.jpg`;
    const link = `https://willy-vilca.github.io/FrontEnd-Proyecto-Distribuidora/producto-info.html?id=${producto.id_producto}`;

    // Preparar prompt para generar un mensaje formal y persuasivo (sin bromas)
    const promptRecom = relatedFound
      ? `Eres un asistente de ventas formal y profesional y amable usa emojis. El usuario buscó: "${mensajeCliente}". Genera un mensaje breve 2 oraciones , educado y persuasivo, que explique por qué este producto es relevante y convide a verlo o comprarlo. No uses humor ni bromas. No inventes características adicionales.`
      : `Eres un asistente de ventas formal y profesional y amable usa emojis . El usuario escribió algo no relacionado con la tienda: "${mensajeCliente}". Sugiere este producto de forma breve (2-3 oraciones), destacando por qué podría interesarle y animando a visitar el enlace. Mantén tono formal y profesional.`;

    // Incluir datos del producto en el prompt
    const fullPrompt = `${promptRecom}\n\nProducto:\nNombre: ${producto.nombre}\nDescripcion: ${producto.descripcion || 'Sin descripción'}\nPrecio: S/ ${producto.precio}\nImagen: ${safeImage}\nLink: ${link}`;

    if (model) {
      try {
        const respuesta = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        });
        const textoIA = respuesta?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (textoIA) {
        return `No tengo exactamente ese producto, pero este podría interesarte 😊\n${safeImage}\n🛒 Ver producto: ${link}`;
        }

      } catch (e) {
        console.warn('⚠️ Error generando texto con IA en sugerirProducto:', e.message);
      }
    }

    // Fallback: construir mensaje localmente
    return `No cuento con ese producto exacto, pero este podría interesarte 😊\n${safeImage}\n🛒 Ver producto: ${link}`;


  } catch (err) {
    console.error("⚠️ Error en sugerirProducto:", err.message);
    return "Lo siento, ocurrió un error al generar la sugerencia. Intenta de nuevo.";
  }



}

// Obtener un producto completo por nombre (coincidencia parcial) desde la base de datos
async function obtenerProductoPorNombre(client, nombre) {
  try {
    if (!client || !client._connected) {
      console.warn('⚠️ Cliente de base de datos no conectado.');
      return null;
    }

    if (!nombre || String(nombre).trim().length === 0) return null;

    const query = `
      SELECT id_producto, nombre, descripcion, precio, stock
      FROM productos
      WHERE LOWER(nombre) LIKE LOWER($1)
      LIMIT 1;
    `;

    const search = `%${String(nombre).trim()}%`;
    const result = await client.query(query, [search]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id_producto,
      nombre: row.nombre,
      descripcion: row.descripcion,
      precio: row.precio,
      stock: typeof row.stock !== 'undefined' ? Number(row.stock) : null
    };
  } catch (err) {
    console.error('⚠️ Error en obtenerProductoPorNombre:', err.message);
    return null;
  }
}

// Endpoint simple para obtener producto por nombre (consulta GET /product?name=...)
app.get('/product', async (req, res) => {
  try {
    const { name } = req.query || {};
    if (!name) return res.status(400).json({ error: 'Falta parámetro "name" en la consulta' });
    if (!clientConnected || !client) return res.status(503).json({ error: 'Base de datos no disponible' });

    const producto = await obtenerProductoPorNombre(client, name);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    // Devolver el objeto tal cual (contendrá columnas de la tabla productos)
    return res.json({ product: producto });
  } catch (err) {
    console.error('Error en /product:', err.message);
    return res.status(500).json({ error: 'Error interno al buscar producto' });
  }
});



// Nuevo método: extraerPalabraClave
// Devuelve UNA sola palabra que represente la palabra clave/producto principal del mensaje.
async function extraerPalabraClave(model, mensajeUsuario) {
  const prompt = `
Analiza el siguiente mensaje y responde SOLO con UNA palabra que represente el producto
o la palabra clave más importante mencionada por el usuario. Responde únicamente con
esa palabra, sin explicaciones ni puntuación adicional.

Ejemplos:
- "quiero unos auriculares samsung" -> "auriculares samsung"
- "quiero pollo para la cena" -> "pollo"
- "tienen café?" -> "cafe"
- "busco mariscos" -> "mariscos"
Mensaje: "${mensajeUsuario}"
`;

  try {
    // Si hay un modelo disponible, pedirle que extraiga la palabra clave
    if (model) {
      const respuesta = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const palabra = respuesta?.response?.candidates?.[0]?.content?.parts?.[0]?.text
        ?.trim()
        ?.toLowerCase();

      if (palabra) {
        console.log(`🔎 Palabra clave extraída (IA): "${palabra}"`);
        return palabra;
      }
    }

    // Fallback heurístico simple: eliminar palabras vacías y devolver la primera significativa
    const stopwords = [
      'quiero','unos','un','una','para','el','la','los','las','con','de','del','por','que',
      'me','tienes','algo','puedo','puede','necesito','busco','tengo','tener','hay','donde',
      'como','yo','porfavor','por favor','hola','buenas','buenos','dias','tardes','no'
    ];

    // Normalizar: quitar caracteres no alfanuméricos (mantener letras unicode) y split
    const tokens = String(mensajeUsuario)
      .toLowerCase()
      .replace(/[^^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const candidatos = tokens.filter(t => !stopwords.includes(t));
    const resultado = candidatos.length ? candidatos[0] : (tokens[0] || mensajeUsuario.toLowerCase());

    console.log(`🔎 Palabra clave extraída (heurística): "${resultado}"`);
    return resultado;
  } catch (err) {
    console.error('⚠️ Error en extraerPalabraClave:', err.message);
    return mensajeUsuario.toLowerCase();
  }
}


startServer();

