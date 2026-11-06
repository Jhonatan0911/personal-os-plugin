---
tipo: diccionario-de-frentes
frentes:
  # Declara aquí los frentes funcionales de tu equipo (módulos, productos, áreas de negocio).
  # personas-append.js RECHAZA un frente que no esté en esta lista: el módulo nunca inventa uno.
  # Quita el "#" de este ejemplo ficticio y ajústalo, o escribe los tuyos con la misma forma:
  #
  # - clave: facturacion
  #   nombre: "Facturación electrónica"
  #   alias: [facturacion, factura, facturas, cobros]
  #   repos: [servicio-facturacion]
  #   alerta: "Cierre de mes: no puede quedar sin cobertura la última semana"
  #
  # - clave: pagos
  #   nombre: "Pasarela de pagos"
  #   alias: [pasarela, pasarela de pagos, checkout]
  #   repos: [api-pagos, web-checkout]
---

# Diccionario de frentes

Este archivo es lo que permite que el módulo de personas entienda cómo hablas. Cuando dices
*"¿quién sabe de la pasarela?"*, `personas-query.js quien` busca "pasarela" entre los alias de
cada frente.

- **clave**: identificador estable del frente (sin espacios). Es lo que se guarda en las fichas.
- **nombre**: cómo se muestra.
- **alias**: todas las formas en que lo nombras, con o sin tildes (la búsqueda las ignora).
  Se reconocen como palabra completa, así que una sigla corta funciona sin enganchar dentro de
  otras palabras.
- **repos** *(opcional)*: repositorios del frente; `personas-doa.js` los usa para ligar el bus
  factor de código con el frente.
- **alerta** *(opcional)*: lo que hay que recordar cuando el frente se queda sin nadie.

Cuando uses una palabra que el diccionario no tiene, agrégala como alias aquí.
