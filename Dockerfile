FROM node:16.9.1

WORKDIR /

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 80

CMD ["npm","start"]