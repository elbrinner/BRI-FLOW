# Expresiones y funciones

El editor y el simulador soportan expresiones en múltiples campos (por ejemplo condiciones, asignaciones, filtros, etc.).

## Sintaxis

- Literales: números, strings, booleanos
- Operadores: `+ - * / %`, comparaciones (`< <= > >= == === != !==`), lógicos (`&& || !`)
- Ternario: `cond ? a : b`
- Llamadas a función: `len(texto)`, `split(s, ",")`, etc.
- Acceso por ruta: `user.name`, `context.locale`

## Registro de funciones (canónico)

La lista y semántica de funciones está implementada en `js/expression_parser.js`.

### Ejemplos comunes

- Longitud: `len(nombre)`
- Normalización: `trim(upper(texto))`
- Listas: `addItem(lista, "x")`, `removeAt(lista, 0)`
- Coalesce: `coalesce(a, b, "default")`

### Funciones tipo LINQ (colecciones)

Para colecciones hay helpers como `where/filter`, `select/map`, `orderBy`, `distinct`, `take/skip`, `sum/avg/min/max`, etc.

Estas funciones aceptan selectores/predicados como expresión string evaluada con scope local:

- `item`: elemento actual
- `index`: índice
- `acc`: acumulador (en `reduce`)

Ejemplo conceptual:

- `where(users, "item.age >= 18")`
- `select(users, "item.name")`

## Notas

- La evaluación es defensiva: expresiones inválidas suelen devolver `undefined`/valores neutros según el caso.
- Evita depender de coerciones ambiguas; usa `toNumber()` o `bool()` cuando sea necesario.
