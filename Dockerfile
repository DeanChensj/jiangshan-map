FROM nginx:alpine
COPY . /usr/share/nginx/html
RUN chmod -R a+rX /usr/share/nginx/html
EXPOSE 80