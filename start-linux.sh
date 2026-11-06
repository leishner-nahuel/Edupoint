#!/usr/bin/env bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "No se encontro Node.js. Instalalo con el gestor de paquetes de tu sistema."
  read -r -p "Presioná Enter para salir..."
  exit 1
fi
node server.js
