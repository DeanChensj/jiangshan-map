FROM nginx:alpine
COPY --chmod=a+rX . /usr/share/nginx/html
EXPOSE 80