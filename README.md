# AuditPro — Dashboard de Auditoría

Dashboard de auditoría para restaurante argentino. Next.js 14, Tailwind, Recharts, Claude AI.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # rellenar las vars
npm run dev                   # http://localhost:3000
```

## Deploy en Vercel

1. **Push a GitHub** (crear repo vacío y pushear este proyecto)
2. **Importar en Vercel**: vercel.com/new → Import Git Repository
3. **Variables de entorno** (Vercel Dashboard → Settings → Environment Variables):
   ```
   ANTHROPIC_API_KEY     = sk-ant-...
   BLOB_READ_WRITE_TOKEN = vercel_blob_rw_...
   BLOB_BASE_URL         = https://xxxx.public.blob.vercel-storage.com
   SYNC_SECRET           = tu-secret-aleatorio
   ```
4. **Deploy** → Vercel asigna una URL como `https://audit-next-xxx.vercel.app`
5. Agregar esa URL como `PRODUCTION_URL` en `.env.local`

## Configurar Vercel Blob (datos en vivo)

1. Vercel Dashboard → Storage → Create → Blob
2. Conectar al proyecto → copiar `BLOB_READ_WRITE_TOKEN`
3. Hacer el primer upload para obtener el `BLOB_BASE_URL`:
   ```bash
   BLOB_READ_WRITE_TOKEN=xxx node scripts/upload-to-blob.js
   # Imprime: Set BLOB_BASE_URL=https://xxxx.public.blob.vercel-storage.com
   ```
4. Setear `BLOB_BASE_URL` en Vercel (Settings → Env Vars) y en `.env.local`

## Sync automático (datos en vivo)

El script `scripts/sync.sh` copia el MDB del POS, exporta los datos y los sube a Vercel Blob.

```bash
# Test manual
source .env.local && bash scripts/sync.sh

# Instalar cron (cada 15 minutos)
crontab -e
# Agregar:
*/15 * * * * source /ruta/a/audit-next/.env.local && /ruta/a/audit-next/scripts/sync.sh >> /ruta/a/audit-next/logs/cron.log 2>&1
```

Para montar el MDB desde la PC del POS via red local:
```bash
# macOS - agregar al .env.local:
MDB_SOURCE=/Volumes/POS/db.mdb

# Montar la carpeta compartida del POS PC:
mount_smbfs //usuario:password@192.168.1.X/compartida /Volumes/POS
```
