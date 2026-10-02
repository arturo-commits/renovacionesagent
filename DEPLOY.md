# Despliegue de Tuio Academy en ssh.tuiolabs.com

Guía paso a paso para dejar la plataforma en producción en el servidor `ssh.tuiolabs.com` con Docker.

> **Dominio de la web.** En esta guía se usa `formacion.tuiolabs.com` como ejemplo. Sustitúyelo por el dominio definitivo en
> `APP_URL` (`.env.production`) y en la configuración de nginx o de Cloudflare.

## Qué se despliega

| Pieza | Qué hace |
|---|---|
| `app` | La aplicación (Next.js) en el puerto 3000, **solo accesible desde el propio servidor**. |
| `cron` | Tareas programadas: recordatorios por email (8:45, lunes a viernes) y copia de seguridad diaria (2:30). |
| `./data` | Base de datos SQLite, copias (`data/backups`) y registro de tareas (`data/cron.log`). **Es lo único que hay que conservar.** |
| nginx o Cloudflare Tunnel | Publica la web con HTTPS en el dominio. |

## 1. Requisitos del servidor

- Linux con **Docker** y el plugin **docker compose** (`docker compose version`).
- `git` y `curl`.
- Acceso de lectura al repositorio `arturo-commits/renovacionesagent` (por ejemplo con una *deploy key* de GitHub).
- Salida a internet por el puerto SMTP (465 o 587) para enviar correo desde `formacion@tuio.com`.

## 2. Descargar el código

```bash
sudo mkdir -p /opt/tuio-academy && sudo chown "$USER" /opt/tuio-academy
git clone git@github.com:arturo-commits/renovacionesagent.git /opt/tuio-academy
cd /opt/tuio-academy
git checkout claude/magical-darwin-awbcho   # o main cuando se fusione
```

## 3. Configuración (`.env.production`)

```bash
cp .env.example .env.production
chmod 600 .env.production
nano .env.production
```

Valores mínimos:

| Variable | Valor |
|---|---|
| `APP_URL` | `https://formacion.tuiolabs.com` (la URL pública; se usa en los enlaces de los correos) |
| `ADMIN_EMAIL` | `formacion@tuio.com` (cuenta inicial de Superadministración) |
| `ADMIN_PASSWORD` | Una contraseña provisional fuerte. **Cámbiala al entrar por primera vez.** |
| `MAIL_FROM` | `Tuio Academy <formacion@tuio.com>` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | Con Google Workspace: `smtp.gmail.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASS` | `formacion@tuio.com` y su **contraseña de aplicación** |
| `CRON_SECRET` | Clave larga aleatoria: `openssl rand -hex 32` |
| `ALLOWED_EMAIL_DOMAINS` | `tuio.com` para que solo se registren emails de Tuio (vacío = cualquiera) |

No hace falta `DATABASE_PATH`: Docker la fija en `/data/tuio-academy.db` (carpeta `./data` del servidor).

**Contraseña de aplicación de Google Workspace:** entra con `formacion@tuio.com` → Cuenta de Google → Seguridad →
activa la verificación en dos pasos → «Contraseñas de aplicaciones» → crea una para «Tuio Academy» y pégala en `SMTP_PASS`.
Si el administrador de Workspace lo prefiere, se puede usar el servicio *SMTP relay* (`smtp-relay.gmail.com`).

## 4. Primer arranque

```bash
docker compose up -d --build
docker compose ps                      # app debe salir como "healthy"
curl -fsS http://127.0.0.1:3000/api/health   # {"ok":true}
```

Al arrancar por primera vez se crea la base de datos con los cursos de ejemplo y la cuenta `formacion@tuio.com`.

## 5. Publicar con HTTPS

`ssh.tuiolabs.com` resuelve a direcciones de **Cloudflare**, así que lo más probable es que el dominio ya esté en Cloudflare.
Elige una de las dos opciones:

### Opción A — Cloudflare Tunnel (recomendada si ya usáis Cloudflare para el SSH)

1. En el panel de Cloudflare Zero Trust → Networks → Tunnels, abre el túnel del servidor (o crea uno con `cloudflared`).
2. Añade un *Public hostname*: `formacion.tuiolabs.com` → `http://127.0.0.1:3000`
   (o en `/etc/cloudflared/config.yml`, ver `deploy/cloudflared-config.yml`).
3. Cloudflare se encarga del certificado. No hay que abrir puertos en el servidor.

### Opción B — nginx + Let's Encrypt

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo cp deploy/nginx-tuio-academy.conf /etc/nginx/sites-available/tuio-academy
sudo sed -i 's/formacion.tuiolabs.com/TU-DOMINIO/g' /etc/nginx/sites-available/tuio-academy
sudo ln -s /etc/nginx/sites-available/tuio-academy /etc/nginx/sites-enabled/
sudo certbot --nginx -d TU-DOMINIO
sudo nginx -t && sudo systemctl reload nginx
```

Si el registro DNS está en Cloudflare con el proxy activado (nube naranja), pon el modo SSL en **Full (strict)**.

## 6. Comprobaciones tras el despliegue

1. Abre `https://formacion.tuiolabs.com`, entra con `formacion@tuio.com` y la contraseña provisional, y **cámbiala** en *Mi perfil*.
2. **Gestión → Correo**: debe salir «Envío real (SMTP)». Pulsa **Enviar prueba** y comprueba que llega.
3. **Gestión → Equipo y roles**: añade a las personas de Administración de formación y de Seguimiento (les llega la invitación por email).
4. Recordatorios: `docker compose exec cron sh -c '. /etc/cron.env; curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_INTERNAL_URL/api/cron/recordatorios'`
5. Copia de seguridad manual: `docker compose exec cron sh -c '. /etc/cron.env; backup.sh'` y comprueba `ls data/backups`.

## 7. Actualizar a una nueva versión

```bash
cd /opt/tuio-academy
./deploy/deploy.sh            # copia de seguridad → git pull → rebuild → comprobación de salud
```

Las actualizaciones de la base de datos se aplican solas al arrancar.

## 8. Copias de seguridad y restauración

- Se hace una copia diaria comprimida en `data/backups/` y se guardan 30 días (`BACKUP_KEEP_DAYS`).
- **Recomendado:** sacar esas copias fuera del servidor (por ejemplo con `rclone` a Google Drive o a un bucket), porque si se pierde el disco se pierden también.
- Restaurar:
  ```bash
  docker compose stop app
  gunzip -c data/backups/tuio-academy-AAAAMMDD-HHMMSS.db.gz > data/tuio-academy.db
  rm -f data/tuio-academy.db-wal data/tuio-academy.db-shm
  docker compose start app
  ```

## 9. Operación diaria

| Para | Comando |
|---|---|
| Ver el estado | `docker compose ps` |
| Ver los registros de la aplicación | `docker compose logs -f app` |
| Ver las tareas programadas | `tail -f data/cron.log` |
| Reiniciar | `docker compose restart app` |
| Parar todo | `docker compose down` (los datos de `./data` se conservan) |

## 10. Seguridad

- La aplicación solo escucha en `127.0.0.1:3000`; el acceso público pasa siempre por HTTPS (Cloudflare o nginx).
- Las cookies de sesión son `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- El acceso tiene freno a la fuerza bruta (5 fallos por email y 20 por IP cada 15 minutos).
- `.env.production` contiene secretos (SMTP, CRON_SECRET): permisos `600` y nunca en git.
- La carpeta `data/` contiene datos personales (RGPD): restringe su acceso y cifra las copias que salgan del servidor.
