# Expresiones (backend) — Referencia completa

Esta referencia describe las expresiones y funciones evaluadas por el backend (proyecto `egoverabot-assistant`, carpeta `Helpers/Expression`).

## Dónde se evalúan

- **IF/Condition (booleano):** `BooleanExpressionEvaluator`.
- **Valores (assign_var, plantillas, etc.):** `ValueExpressionEvaluator` + `ExpressionFunctionRegistryFactory`.

> Nota: `{{ ... }}` se normaliza a su contenido (placeholders) antes de evaluar.

## Operadores y sintaxis

### Booleano (Condition / IF)

Soporta división por **OR** y **AND** a nivel superior:

- `a && b`
- `a || b`
- `!expr` (negación simple)

Comparaciones:

- `==`, `!=`, `>`, `>=`, `<`, `<=`
- `contains` (operador): `list contains value` o `string contains substring`

Normalizaciones:

- `and`/`or` (texto) se convierte a `&&`/`||`.
- `undefined` se trata como `null`.
- Accesos tipo `x['prop']` / `x["prop"]` se normalizan a `x.prop`.
- `len(x)` dentro del IF se sustituye por su valor numérico (longitud) durante la normalización.

### Valores (assign_var / plantillas)

- Aritmética a nivel superior:
  - `a + b` (numérica si ambos son números; si no, concatena strings)
  - `a - b`, `a * b`, `a / b`, `a % b`
- Comparaciones a nivel superior (también en evaluación de valor): `==`, `!=`, `>`, `>=`, `<`, `<=`
- Llamadas a función: `fn(arg1, arg2, ...)`
  - Soporta sufijos sobre el resultado: `fn(...).prop[0].sub`
- Literal de objeto (estilo C#): `new { A = expr, B = expr }`

## Funciones disponibles (registry)

Fuente: `Helpers/Expression/Core/ExpressionFunctionRegistryFactory.cs`.

### Strings

- `trim(x)` → string
- `upper(x)` → string
- `lower(x)` → string
- `contains(hay, needle)` → bool (si `hay` es lista/array, busca coincidencia)
- `startsWith(s, prefix)` → bool
- `endsWith(s, suffix)` → bool
- `split(text, sep)` → list
- `join(list, sep)` → string

### Números

- `len(x)` → number (string/list)
- `toNumber(x)` → number
- `round(x[, decimals])` → number
- `add(a, b)` → number|string (suma si ambos numéricos; si no, concatena)

### Checks / nulidad

- `isEmpty(x)` → bool
- `isNull(x)` → bool
- `isNotNull(x)` → bool
- `isDefined(path)` → bool
- `isUndefined(path)` → bool
- `coalesce(a, b, c, ...)` → any (primer valor no vacío)

### Colecciones (tipo LINQ)

Básicas:

- `count(list[, pred])` → number
- `where(list, 'pred')` → list
- `select(list, 'expr')` → list
- `selectMany(list, 'expr')` → list
- `map(list, 'expr')` → list (alias de `select`)
- `if(cond, then, else)` → any
- `any(list, 'pred')` → bool
- `all(list, 'pred')` → bool
- `first(list[, 'pred'])` → any
- `last(list[, 'pred'])` → any
- `indexOf(list, value)` → number
- `findIndex(list, 'pred')` → number
- `flatten(list)` → list
- `reverse(list)` → list
- `slice(list, start[, count])` → list

Agregación / estadística:

- `sum(list[, 'expr'])` → number
- `avg(list[, 'expr'])` → number
- `min(list[, 'expr'])` → number
- `max(list[, 'expr'])` → number
- `reduce(list, init, 'accExpr')` → any
- `median(list[, 'expr'])` → number
- `percentile(list, p[, 'expr'])` → number
- `mode(list[, 'expr'])` → any

Claves y conjuntos:

- `keyBy(list, 'keyExpr')` → object
- `distinct(list[, 'keyExpr'])` → list
- `groupBy(list, 'keyExpr')` → list<{ key, items }>
- `union(a, b[, 'keyExpr'])` → list
- `intersect(a, b[, 'keyExpr'])` → list
- `except(a, b[, 'keyExpr'])` → list
- `orderBy(list, 'expr')` → list
- `orderByDesc(list, 'expr')` → list

### Comparación (helpers)

- `equals(a, b)` → bool
- `notEquals(a, b)` → bool
- `greater(a, b)` → bool
- `greaterOrEquals(a, b)` → bool
- `less(a, b)` → bool
- `lessOrEquals(a, b)` → bool

### Lógicos (helpers)

- `and(a, b, ...)` → bool
- `or(a, b, ...)` → bool
- `not(x)` → bool

### Mutación de listas

- `addItem(list, value[, index])` → list
- `removeItem(list, value)` → list
- `removeAt(list, index)` → list

### JSON / rutas

- `parseJson(str)` → object|null
- `stringify(obj)` → string|null
- `set(obj, propName, value)` → object (nuevo dict)
- `setPropWhere(list, pred, propName, value)` → list
- `deepMap(root, path, expr)` → object
- `setAtPath(root, 'A.B[2].C', value)` → object (mutación in-place)
- `removeAtPath(root, 'A.B[2].C')` → object (mutación in-place)
- `setAtPathWhere(root, path, pred, propName, value)` → object

### Archivos

- `readJsonFile(path)` → object|null

### Concat

- `concat(a, b, c, ...)` → list (concatena listas; valores no-lista se agregan como elementos)

### Dominio / Journey

- `appendUseCaseItem(root, viewName, catalogueName, sectionName, newItem)` → object
- `normalizeDataJson(root)` → object
- `buildJourney(root[, currentView[, currentCatalog[, currentSection[, role]]]])` → object

### Persistencia (dominio)

Estas funciones mutan estructuras del `dataJson` del dominio. Se listan aquí por completitud:

- `persistBASelectionsView(root, viewName, purisOrNames, layer)`
- `persistDSSelectionsView(root, viewName, purisOrNames, layer)`
- `persistBASelectionsSection(root, viewName, catalogueName, sectionName, purisOrNames, layer)`
- `persistBASelectionsSectionByIndex(root, viewName, catalogueName, sectionIndex, purisOrNames, layer)`
- `persistDSSelectionsSection(root, viewName, catalogueName, sectionName, purisOrNames, layer)`
- `persistDSSelectionsSectionByIndex(root, viewName, catalogueName, sectionIndex, purisOrNames, layer)`
- `persistUCItem(root, viewName, catalogueName, sectionName, name, description, layer)`
- `persistUCItems(root, viewName, catalogueName, sectionName, itemsArray, layer)`
- `persistUCItemsByIndex(root, viewName, catalogueName, sectionIndex, itemsArray, layer)`
- `recalcViewCompletion(root, viewName, catalogueName, layer)`
- `persistLastSectionCompletedByIndex(root, viewName, catalogueName, sectionIndex, lastSectionCompleted, layer)`

## Ejemplos rápidos

- Contar elementos: `len(items)` o `count(items)`
- Filtrar y contar: `count(where(users, 'item.age >= 18'))`
- Proyección: `select(users, 'item.name')`
- Orden y corte: `slice(orderBy(users,'item.age'), 0, 2)`
- JSON ruta: `setAtPath(data, 'Analysis[0].ViewName', 'MiVista')`
