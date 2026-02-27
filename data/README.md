# Carpeta de Datos Persistentes

Esta carpeta contiene los datos persistentes de los servicios Docker. Los datos se mantienen incluso cuando los contenedores se reinician o eliminan.

## Estructura

```
data/
├── mongodb/     # Base de datos MongoDB (usuarios, exámenes, resultados)
└── minio/       # Archivos multimedia (PDFs, imágenes, documentos)
```

## Importante

- **NO eliminar** esta carpeta si quieres mantener tus datos
- Los archivos están excluidos de Git (ver .gitignore)
- Configurado con SELinux `:Z` para Fedora/RHEL
- Permisos: 755 (rwxr-xr-x)

## Backup

Para hacer backup de tus datos:

```bash
# Backup completo
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# Backup solo MongoDB
tar -czf mongodb-backup-$(date +%Y%m%d).tar.gz data/mongodb/

# Backup solo MinIO
tar -czf minio-backup-$(date +%Y%m%d).tar.gz data/minio/
```

## Restaurar

Para restaurar desde un backup:

```bash
# Detener los servicios primero
docker-compose down

# Restaurar
tar -xzf backup-YYYYMMDD.tar.gz

# Reiniciar servicios
docker-compose up -d
```
