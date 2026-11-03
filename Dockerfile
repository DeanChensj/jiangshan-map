# syntax=docker/dockerfile:1
FROM nginx:alpine
COPY --chmod=755 . /usr/share/nginx/html
EXPOSE 80
