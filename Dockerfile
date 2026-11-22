FROM node:20-alpine AS topics-builder
WORKDIR /src
COPY scripts/build_seo_topics.js scripts/sync_version.js scripts/
COPY scripts/topics scripts/topics
COPY data/topics data/topics
COPY data/sources data/sources
COPY js js
COPY topics/assets topics/assets
COPY index.html sitemap.xml llms.txt ./
RUN node scripts/build_seo_topics.js --html-only

FROM nginx:alpine
COPY --chmod=a+rX index.html manifest.webmanifest robots.txt sitemap.xml llms.txt /usr/share/nginx/html/
COPY --chmod=a+rX assets /usr/share/nginx/html/assets
COPY --chmod=a+rX css /usr/share/nginx/html/css
COPY --chmod=a+rX js /usr/share/nginx/html/js
COPY --chmod=a+rX geojson /usr/share/nginx/html/geojson
COPY --from=topics-builder --chmod=a+rX /src/topics /usr/share/nginx/html/topics
EXPOSE 80