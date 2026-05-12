# Usamos la imagen oficial de Node.js (versión ligera 'alpine')
FROM node:18-alpine

# Creamos y nos movemos a la carpeta de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copiamos primero package.json para aprovechar la caché de Docker
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos el resto del código fuente de nuestra aplicación
COPY . .

# Exponemos el puerto en el que corre nuestra app Node
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["npm", "start"]
