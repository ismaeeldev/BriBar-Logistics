# Prueba de aceptación — BRIBAR Logística V1

Guía paso a paso para verificar que la V1 hace todo lo que el documento de
requisitos (SRS) exige. Las referencias `SRS x.y` remiten a las secciones del
SRS y sirven al equipo técnico para localizar cada criterio; el cliente puede
ignorarlas.

> Versión web interactiva (marcar resultados, copiar resumen, imprimir):
> comparta con el cliente el enlace del artefacto generado para esta guía.

---

## Antes de empezar

Necesita:

- Un **ordenador** para las tareas de administración.
- Un **teléfono móvil** para probar el trabajo del conductor, tal como se usará
  en ruta.
- Entre 45 y 60 minutos.

| Dato | Valor |
| --- | --- |
| Dirección web | `__________________` (la facilita el equipo técnico) |
| Usuario administrador | `__________________` |
| Contraseña | `__________________` |

**Cómo puntuar cada comprobación**

- **Correcto** — funciona como se describe.
- **A revisar** — no ocurre lo esperado, o tiene dudas. Anote qué ha visto y,
  si puede, adjunte una captura de pantalla.

**Avisos**

- La comprobación **E2** necesita una cuenta de prueba que pueda desactivar.
- La comprobación **F2** cambia el origen/destino de una ruta real: recuerde
  dejarlos como estaban al terminar.

---

## Parte A — Configuración inicial

En el ordenador, como administrador. Prepara los datos que después usará el conductor.

### A1 · Iniciar sesión como administrador
`SRS 8.1 · 17.1`

**Qué hacer**

1. Abra la dirección web en el ordenador.
2. Introduzca el usuario y la contraseña de administrador.
3. Pulse «Iniciar sesión».

**Resultado esperado** — Entra en el panel de administración. Ve la cola de
aprobación y el menú lateral con Servicios, Conductores, Vehículos y Rutas.

- [ ] Correcto
- [ ] A revisar — Notas:

### A2 · Crear un vehículo
`SRS 13.3`

**Qué hacer**

1. Vaya a Vehículos → «Nuevo vehículo».
2. Escriba una matrícula (por ejemplo, una real de la flota) y, opcionalmente,
   un nombre de referencia.
3. Guarde.

**Resultado esperado** — El vehículo aparece en la lista, marcado como activo.

- [ ] Correcto
- [ ] A revisar — Notas:

### A3 · Crear una ruta / contrato con origen y destino
`SRS 14.2`

**Qué hacer**

1. Vaya a Rutas → «Nueva ruta / contrato».
2. Rellene código, nombre, origen y destino.
3. Guarde. Cree al menos **dos** rutas para poder probar el cambio de ruta más
   adelante.

**Resultado esperado** — Cada ruta aparece en la lista con su origen y destino,
marcada como activa.

- [ ] Correcto
- [ ] A revisar — Notas:

### A4 · Crear un conductor
`SRS 12.2`

**Qué hacer**

1. Vaya a Conductores → «Nueva cuenta».
2. Rellene nombre, usuario, una contraseña inicial y elija el rol «Conductor».
3. Deje la cuenta activa y guarde.

**Resultado esperado** — La cuenta aparece en la lista con el rol «Conductor» y
estado activo.

- [ ] Correcto
- [ ] A revisar — Notas:

### A5 · Asignar vehículo y rutas al conductor
`SRS 12.5 · 12.6`

**Qué hacer**

1. Abra la ficha del conductor que acaba de crear.
2. Asígnele un vehículo predeterminado.
3. Márquele varias rutas como asignadas y elija una de ellas como ruta
   predeterminada.
4. Guarde.

**Resultado esperado** — Se guarda un vehículo predeterminado, una ruta
predeterminada y una o más rutas adicionales asignadas a ese conductor.

- [ ] Correcto
- [ ] A revisar — Notas:

### A6 · Solo se permite una ruta predeterminada
`SRS 19.6`

**Qué hacer**

1. En la misma ficha, intente marcar una segunda ruta como predeterminada.

**Resultado esperado** — El sistema no deja tener dos rutas predeterminadas a la
vez: al marcar una nueva, deja de serlo la anterior (o se le impide guardar).

- [ ] Correcto
- [ ] A revisar — Notas:

---

## Parte B — Registrar un servicio

En el teléfono móvil, como conductor. Es el flujo principal del día a día.

### B1 · El conductor inicia sesión en el móvil
`SRS 23.1 · 27.2`

**Qué hacer**

1. En el teléfono, abra la dirección web.
2. Inicie sesión con el usuario y la contraseña del conductor.

**Resultado esperado** — Entra en el panel del conductor. Todo se lee y se pulsa
con comodidad en la pantalla del móvil, sin desplazamiento horizontal. El botón
«Añadir servicio» es lo más visible.

- [ ] Correcto
- [ ] A revisar — Notas:

### B2 · «Añadir servicio»: los datos automáticos son correctos
`SRS 9.2 · 27.3`

**Qué hacer**

1. Pulse «Añadir servicio».
2. Revise, sin tocar nada, los datos que aparecen ya rellenos.

**Resultado esperado** — Aparecen automáticamente: un ID de servicio, la fecha
de hoy, el nombre del propio conductor, su vehículo predeterminado, su ruta
predeterminada, y el origen y el destino de esa ruta. El conductor no puede
cambiar la fecha ni el conductor.

- [ ] Correcto
- [ ] A revisar — Notas:

### B3 · Cambiar el vehículo
`SRS 9.5 · 13.5 · 27.4`

**Qué hacer**

1. Abra el selector de vehículo y elija otro vehículo activo distinto del
   predeterminado.

**Resultado esperado** — Se puede cambiar el vehículo. El origen, el destino y
la ruta no cambian al hacerlo.

- [ ] Correcto
- [ ] A revisar — Notas:

### B4 · Cambiar de ruta actualiza origen y destino
`SRS 14.3 · 14.4 · 27.5 · 27.6`

**Qué hacer**

1. Abra el selector de ruta.
2. Compruebe qué rutas ofrece.
3. Elija otra de las rutas asignadas a este conductor.

**Resultado esperado** — Solo aparecen las rutas asignadas a este conductor (no
todas las del sistema). Al elegir otra, el origen y el destino se actualizan
solos con los de esa ruta.

- [ ] Correcto
- [ ] A revisar — Notas:

### B5 · No se puede enviar sin los seis campos obligatorios
`SRS 9.3 · 27.7`

**Qué hacer**

1. Deje en blanco alguno de estos seis campos: KM inicial cuadro, KM inicial
   base, KM final base, KM final cuadro, hora de salida, hora de llegada.
2. Intente enviar el servicio.

**Resultado esperado** — No deja enviar. Señala junto al campo qué falta, y no
se pierde lo que ya había escrito en los demás campos.

- [ ] Correcto
- [ ] A revisar — Notas:

### B6 · «Sitios» y «Observaciones» son opcionales
`SRS 9.4 · 27.8`

**Qué hacer**

1. Rellene los seis campos obligatorios con valores válidos.
2. Deje «Sitios» y «Observaciones» vacíos.

**Resultado esperado** — El servicio se puede enviar igualmente. Esos dos campos
no son obligatorios.

- [ ] Correcto
- [ ] A revisar — Notas:

### B7 · «KM reales» y «KM de servicio» se calculan solos y son exactos
`SRS 6.4 · 10.1 · 27.9 · 27.10`

**Qué hacer**

1. Con los cuatro kilometrajes rellenos, fíjese en los valores calculados.
2. Compruebe a mano: `KM reales = KM final cuadro − KM inicial cuadro`.
3. Compruebe a mano: `KM de servicio = KM final base − KM inicial base`.

**Resultado esperado** — Ambos valores aparecen ya calculados, marcados como
automáticos (no editables), y coinciden exactamente con la resta.

- [ ] Correcto
- [ ] A revisar — Notas:

### B8 · Se rechazan kilometrajes imposibles
`SRS 10.3 · 27.11`

**Qué hacer**

1. Ponga, por ejemplo, un «KM final cuadro» menor que el «KM inicial cuadro» (o
   un «KM final base» menor que el inicial).
2. Intente enviar.

**Resultado esperado** — El sistema rechaza el envío y explica que la secuencia
de kilómetros no es válida.

- [ ] Correcto
- [ ] A revisar — Notas:

### B9 · El servicio válido queda «Pendiente de aprobación»
`SRS 11.2 · 27.12`

**Qué hacer**

1. Corrija los valores para que sean coherentes y envíe el servicio.

**Resultado esperado** — Confirmación de envío. El servicio aparece en la lista
del conductor con estado «Pendiente de aprobación».

- [ ] Correcto
- [ ] A revisar — Notas:

---

## Parte C — Corrección y aprobación

Alternando entre el móvil (conductor) y el ordenador (administrador).

### C1 · El conductor edita su servicio mientras está pendiente
`SRS 11.2 · 27.13`

**Qué hacer**

1. Como conductor, abra el servicio que acaba de enviar.
2. Pulse «Editar», cambie algún valor (por ejemplo una hora) y guarde.

**Resultado esperado** — El conductor puede editar su propio servicio mientras
está pendiente. El cambio se guarda y, si tocó un kilometraje, los KM reales /
KM de servicio se recalculan.

- [ ] Correcto
- [ ] A revisar — Notas:

### C2 · El administrador ve el servicio y todos sus datos
`SRS 16.4 · 27.14`

**Qué hacer**

1. En el ordenador, como administrador, abra ese servicio desde la cola de
   aprobación o desde Servicios.

**Resultado esperado** — Ve todos los datos: automáticos, los que puso el
conductor, los KM calculados, el estado, y las fechas de creación y de última
modificación.

- [ ] Correcto
- [ ] A revisar — Notas:

### C3 · El administrador aprueba; queda registrado quién y cuándo
`SRS 11.3 · 27.15 · 27.16`

**Qué hacer**

1. En la ficha del servicio, pulse «Aprobar servicio» y confirme.

**Resultado esperado** — El estado pasa a «Aprobado». En la información de
auditoría del servicio consta el administrador que aprobó y la fecha y hora de
la aprobación.

- [ ] Correcto
- [ ] A revisar — Notas:

### C4 · Tras aprobar, el conductor ya no puede editar
`SRS 11.4 · 11.5 · 27.17`

**Qué hacer**

1. Como conductor, vuelva a abrir ese servicio.

**Resultado esperado** — El conductor puede verlo, pero ya no aparece la opción
de editar. No puede modificarlo ni devolverlo a pendiente.

- [ ] Correcto
- [ ] A revisar — Notas:

### C5 · El administrador sí puede corregir un servicio aprobado
`SRS 11.4 · 21.3 · 27.18`

**Qué hacer**

1. Como administrador, abra el servicio aprobado y edite algún dato.
2. Guarde.

**Resultado esperado** — El administrador puede corregirlo. Sigue estando
«Aprobado», el conductor no recupera permiso de edición, y el cambio queda
reflejado en la fecha de última modificación.

- [ ] Correcto
- [ ] A revisar — Notas:

---

## Parte D — Historial y consultas

Comprobación de que cada perfil ve lo que le corresponde.

### D1 · El conductor consulta su historial
`SRS 15.2 · 27.19`

**Qué hacer**

1. Como conductor, abra «Ver historial» / «Mis servicios».

**Resultado esperado** — Ve la lista de sus propios servicios, con estado,
fecha, ruta, vehículo y kilómetros. No ve servicios de otros conductores.

- [ ] Correcto
- [ ] A revisar — Notas:

### D2 · El administrador ve todos los servicios y filtra
`SRS 16.3 · 27.20`

**Qué hacer**

1. Como administrador, vaya a Servicios.
2. Pruebe los filtros: por fecha o intervalo de fechas, por conductor, por
   vehículo, por ruta y por estado (pendiente / aprobado).

**Resultado esperado** — Ve los servicios de todos los conductores. Cada filtro
reduce la lista correctamente y se pueden combinar.

- [ ] Correcto
- [ ] A revisar — Notas:

---

## Parte E — Accesos y seguridad

Que nadie pueda hacer lo que no le corresponde.

### E1 · Un conductor no puede entrar en administración
`SRS 8.3 · 3.1`

**Qué hacer**

1. Con la sesión de conductor iniciada, intente abrir el panel de
   administración añadiendo `/admin` al final de la dirección web.

**Resultado esperado** — No le deja entrar: le redirige a su propio panel o
muestra un aviso de acceso no permitido. No ve ningún dato de administración.

- [ ] Correcto
- [ ] A revisar — Notas:

### E2 · Una cuenta desactivada no puede iniciar sesión
`SRS AUTH-005 · 12.4`

**Qué hacer**

1. Como administrador, cree o use una cuenta de prueba y desactívela.
2. Cierre sesión e intente iniciar sesión con esa cuenta desactivada.

**Resultado esperado** — No puede entrar. El mensaje indica que la cuenta no
está activa, sin revelar más detalles. Los servicios que esa cuenta tuviera
siguen existiendo.

- [ ] Correcto
- [ ] A revisar — Notas:

### E3 · Dos usuarios a la vez, sin mezclar datos _(opcional)_
`SRS 23.4 · 27.21`

**Qué hacer**

1. Con ayuda de otra persona, que dos conductores (o un conductor y un
   administrador) registren un servicio casi al mismo tiempo, cada uno en su
   dispositivo.

**Resultado esperado** — Cada servicio se guarda por separado, con un ID
distinto. Ninguno sobrescribe ni mezcla los datos del otro.

- [ ] Correcto
- [ ] A revisar — Notas:

---

## Parte F — Datos maestros e integridad histórica

Que cambiar la configuración no altere lo ya registrado.

### F1 · Un vehículo desactivado sale de «Añadir servicio» pero no del historial
`SRS 13.4 · 26.5`

**Qué hacer**

1. Como administrador, desactive un vehículo que ya aparezca en algún servicio.
2. Como conductor, abra «Añadir servicio» y mire el selector de vehículo.
3. Como administrador, abra un servicio antiguo que use ese vehículo.

**Resultado esperado** — El vehículo desactivado ya no se ofrece para servicios
nuevos, pero el servicio antiguo sigue mostrándolo con normalidad.

- [ ] Correcto
- [ ] A revisar — Notas:

### F2 · Cambiar el origen/destino de una ruta no altera los servicios ya registrados
`SRS 14.5 · 21.4 · 26.5`

**Qué hacer**

1. Anote el origen y el destino que muestra un servicio ya creado.
2. Como administrador, cambie el origen y/o el destino de esa ruta y guarde.
3. Vuelva a abrir ese servicio anterior.
4. Al terminar, deje el origen/destino de la ruta como estaban.

**Resultado esperado** — El servicio anterior conserva el origen y el destino
que tenía cuando se creó. El cambio solo afecta a los servicios que se creen a
partir de ahora.

- [ ] Correcto
- [ ] A revisar — Notas:

### F3 · Todo queda guardado de forma permanente
`SRS 2.3 · 27.22`

**Qué hacer**

1. Cierre sesión, vuelva a entrar (o abra la web en otro dispositivo).
2. Compruebe que los servicios, conductores, vehículos y rutas creados siguen
   ahí.

**Resultado esperado** — Todos los datos persisten. El sistema no necesita Excel
ni ningún archivo externo para funcionar.

- [ ] Correcto
- [ ] A revisar — Notas:

---

## Al terminar

Revise que no queda ninguna comprobación sin marcar. Cuente cuántas están en
**Correcto** y cuántas en **A revisar**, y haga llegar este documento
(o su resumen) al equipo técnico junto con las capturas de pantalla de los
puntos marcados como **A revisar**.

| Resultado | Nº |
| --- | --- |
| Correcto | |
| A revisar | |
| Sin comprobar | |

Fecha de la prueba: `____________`  ·  Realizada por: `____________`
