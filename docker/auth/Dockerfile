FROM node:22-bookworm-slim
RUN npm install --global firebase-tools@14.27.0
WORKDIR /emulator
COPY firebase.json start.sh ./
ENTRYPOINT ["sh", "/emulator/start.sh"]
