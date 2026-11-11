# Publicar la web de Las Tribulaciones de Sara en Cloudflare

Esta es la **Fase 1**. Todo es gratuito salvo el dominio (unos 10 € al año).
Los nombres de los botones de Cloudflare, GitHub, Resend y Google pueden cambiar un poco con el tiempo. Si algo no aparece donde digo, dímelo y lo buscamos juntas.

## Qué incluye la Fase 1

- La web pública: portada, historia, hermandad, Cuaresma, hermanas con foto y noticias.
- Zona hermana: entrar con correo y contraseña, o con Google. Primer acceso con enlace de bienvenida y "he olvidado mi contraseña".
- Administración (solo administradoras): alta y baja de hermanas, cargos y permisos, estado activa, pasiva o baja, foto y año de entrada, correo de bienvenida, restablecer contraseñas, noticias con foto e historia.

**Todavía no incluye** (son las siguientes fases): sábados y asistencia, cocina y tickets, Mi cuenta y pagos, tesorería, actas y juntas. En la zona hermana aparecen marcadas como "Próximamente".

---

## Paso 1. GitHub: guardar el proyecto

1. Crea una cuenta gratuita en github.com.
2. Pulsa **New repository**. Nombre: `tribulaciones-web`. Márcalo como **Private**. Créalo.
3. En el repositorio, pulsa **uploading an existing file** (o *Add file → Upload files*).
4. Descomprime el ZIP que te he dado y **arrastra todo su contenido** (los archivos `wrangler.jsonc`, `package.json` y las carpetas `src`, `public` y `test`) a esa ventana. Pulsa **Commit changes**.

## Paso 2. Cloudflare: cuenta y base de datos

1. Crea una cuenta gratuita en cloudflare.com.
2. Menú izquierdo: **Storage & databases → D1 SQL database → Create database**. Nombre: `tribulaciones`.
3. Dentro de la base de datos, copia el **Database ID** (una cadena larga de letras y números).
4. Vuelve a GitHub, abre el archivo `wrangler.jsonc`, pulsa el lápiz y cambia `PON_AQUI_EL_ID_DE_LA_BASE_DE_DATOS` por ese ID. Pulsa **Commit changes**.

No hace falta crear tablas: la web las crea sola la primera vez que se usa.

## Paso 3. Conectar GitHub con Cloudflare

1. En Cloudflare: **Workers & Pages → Create → Import a repository** (o *Connect to Git*).
2. Autoriza GitHub y elige `tribulaciones-web`.
3. El nombre del proyecto debe ser **`tribulaciones`** (el mismo que pone `name` en `wrangler.jsonc`).
4. Deja el resto como está y pulsa **Deploy**.
5. Al terminar te da una dirección tipo `https://tribulaciones.TU-NOMBRE.workers.dev`. Ábrela: ya verás la web pública.

A partir de ahora, **cada vez que cambies un archivo en GitHub, la web se actualiza sola** en uno o dos minutos.

## Paso 4. Variables y secretos

En Cloudflare, abre el proyecto `tribulaciones` → **Settings → Variables and Secrets → Add**.

| Nombre | Tipo | Qué poner |
|---|---|---|
| `SITE_URL` | Texto | La dirección de tu web, sin barra al final. De momento la de workers.dev. |
| `ADMIN_EMAIL` | Texto | Tu correo (el de la administradora, Alba). |
| `ADMIN_NAME` | Texto | Tu nombre completo. |
| `SETUP_KEY` | **Secreto** | Una clave larga que te inventes (20 letras o más). Solo sirve para el primer acceso. |

Guarda y espera a que se vuelva a publicar.

## Paso 5. Tu primer acceso

1. Abre `https://TU-WEB/zona/#/setup`.
2. Escribe la `SETUP_KEY` y elige tu contraseña (mínimo 8 caracteres).
3. Entras como administradora. Cuando quieras, borra la variable `SETUP_KEY` en Cloudflare: ya no hace falta.

## Paso 6. Probar sin correo

En **Administración → Hermanas** añade hermanas con su correo, cargo, año de entrada y foto. Marca **Aparece en la web** para las que quieran salir en la portada. Prueba también noticias e historia.

Mientras no esté configurado el correo, los botones de bienvenida y restablecer te avisarán de que falta ese paso. No pasa nada.

## Paso 7. Dominio propio

1. En Cloudflare: **Domain Registration → Register Domains**, busca el nombre que quieras (por ejemplo `lastribulacionesdesara.es`) y cómpralo.
2. En el proyecto `tribulaciones`: **Settings → Domains & Routes → Add → Custom domain** y escribe el dominio.
3. Cambia la variable `SITE_URL` por `https://tu-dominio.es`.

## Paso 8. Correos (Resend)

1. Crea una cuenta gratuita en resend.com.
2. **Domains → Add domain** con tu dominio. Resend te da unos registros DNS: si el dominio está en Cloudflare, tiene un botón para añadirlos automáticamente.
3. **API Keys → Create API key** y copia la clave.
4. En Cloudflare añade dos variables:
   - `RESEND_API_KEY` (**secreto**): la clave.
   - `MAIL_FROM` (texto): `Las Tribulaciones de Sara <hola@tu-dominio.es>`.
5. Prueba: **Administración → Correo de bienvenida → Enviarme una prueba**. Debe llegarte un correo con el escudo.

Con eso funcionan los botones **Enviar bienvenida**, **Restablecer contraseña** y "He olvidado mi contraseña".

## Paso 9. Entrar con Google

1. Entra en console.cloud.google.com y crea un proyecto (`tribulaciones`).
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo **Externo**, nombre "Las Tribulaciones de Sara", tu correo. Al final pulsa **Publicar aplicación** (solo pedimos el correo, no hace falta verificación).
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
4. En **URI de redireccionamiento autorizados** escribe: `https://tu-dominio.es/api/auth/google/callback`
5. Copia el **ID de cliente** y el **secreto** y añádelos en Cloudflare como `GOOGLE_CLIENT_ID` (texto) y `GOOGLE_CLIENT_SECRET` (**secreto**).

Una hermana solo puede entrar con Google si su correo de Google es el que tienes apuntado en su ficha.

## Paso 10. Fotos de la web pública

En GitHub, carpeta `public/img`, sube estos archivos con estos nombres exactos (JPG, mejor de menos de 400 KB):
`historia-1.jpg`, `historia-2.jpg` (la de junto a la línea de tiempo), `hermandad.jpg`, `cuaresma-1.jpg`, `cuaresma-2.jpg`, `cuaresma-3.jpg`.
Mientras no existan, se ve un recuadro de relleno. Las fotos de las hermanas y de las noticias se suben desde Administración.

---

## Seguridad: lo importante

- **Nunca pegues claves ni secretos en el chat, en GitHub o en un correo.** Solo en Cloudflare, en *Variables and Secrets*.
- Las contraseñas se guardan cifradas: ni tú ni yo podemos verlas. Por eso "restablecer" envía un enlace en lugar de mostrarla.
- Tras varios intentos fallidos, el acceso se bloquea unos minutos.
- Para dar de baja a una hermana, cámbiale el estado a **Baja**: pierde el acceso y desaparece de la web, pero se conserva su historial.
- El texto de la web debe incluir un **aviso de privacidad** (fotos y nombres de las hermanas). Lo preparamos juntas antes de publicar.

## Si algo falla

| Síntoma | Qué mirar |
|---|---|
| La web da error tras el Deploy | Que el `database_id` de `wrangler.jsonc` sea el correcto. |
| `/zona/#/setup` dice "No disponible" | Falta la variable `SETUP_KEY`, o aún no se ha vuelto a publicar. |
| "El correo todavía no está configurado" | Faltan `RESEND_API_KEY` y `MAIL_FROM` (paso 8). |
| Google dice "redirect_uri_mismatch" | La URI del paso 9 no coincide exactamente con tu dominio. |
| Un enlace de bienvenida "ha caducado" | Pulsa **Reenviar bienvenida** en su ficha. |
| Una foto no sale en la portada | Marca **Aparece en la web** en su ficha y guarda. |

## Próximas fases

2. Sábados y asistencia, Mi cuenta y pagos. 3. Cocina, tickets y alergias. 4. Tesorería. 5. Actas, juntas y traspaso del blog antiguo.
