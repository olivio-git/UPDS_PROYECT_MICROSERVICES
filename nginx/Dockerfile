# 1.27.3+ is required for `server ... resolve` in upstream blocks.
FROM nginx:1.29-alpine

# Copiar configuración personalizada
COPY nginx.conf /etc/nginx/nginx.conf

# Exponer puerto
EXPOSE 80

# Comando por defecto
CMD ["nginx", "-g", "daemon off;"]
