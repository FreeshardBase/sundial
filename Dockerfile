FROM nginx:alpine

# No build stage: Sundial is no-build, the repo files ARE the app.
COPY index.html manifest.webmanifest sw.js version.json /srv/
COPY js /srv/js
COPY css /srv/css
COPY assets /srv/assets
COPY vendor /srv/vendor
COPY data/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
