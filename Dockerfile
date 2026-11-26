# Sitio estático con Nginx sin privilegios: corre como usuario 101 (no root),
# no necesita capacidades de Linux y escucha en el puerto 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --chown=101:101 nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=101:101 index.html /usr/share/nginx/html/
COPY --chown=101:101 css /usr/share/nginx/html/css
COPY --chown=101:101 js /usr/share/nginx/html/js
COPY --chown=101:101 assets /usr/share/nginx/html/assets
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
