# Tests del simulador (BRI-FLOW/tests)

Este directorio contiene las pruebas rápidas del simulador para validar la semántica de las expresiones en el editor.

## Archivos

- `simulator_expr_list_tests.js`: pruebas ligeras de funciones de lista (addItem, removeItem, removeAt).
- `simulator_expr_parity_tests.js`: suite de paridad que cubre todas las funciones documentadas (len, split, join, toNumber, trim, upper, lower, contains, startsWith, endsWith, isEmpty, coalesce, isNull, isNotNull, isDefined, isUndefined, addItem, removeItem, removeAt, y composiciones básicas).
- `simulator_expr_advanced_tests.js`: casos avanzados de nesting y borde (join+addItem+split, coalesce con join vacío, igualdad laxa en removeItem, índices fuera de rango, etc.).

## Cómo ejecutarlos

Opción A (recomendada): página dedicada

1. Abre `BRI-FLOW/tests/test-runner.html` en el navegador (o con Live Server).
2. Usa los botones:
   - "Tests listas": corre `simulator_expr_list_tests.js`.
   - "Tests expresiones": corre `simulator_expr_parity_tests.js`.
   - "Tests avanzados": corre `simulator_expr_advanced_tests.js`.
3. Los resultados aparecen en el panel de resultados y en la consola del navegador.

Opción B (desde el editor principal)

- No se cargan pruebas en `BRI-FLOW/index.html` para evitar mezclar UI de edición con testeo. Utiliza la página dedicada.

## Notas

- Las pruebas usan `window.ExpressionParser.evaluate(expr, { variables })` con un set de variables base por archivo.
- Son pruebas de humo pensadas para desarrolladores del editor; no requieren infraestructura adicional.
