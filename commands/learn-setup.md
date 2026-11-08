---
description: Choose how you want to learn, without opening the study space
---

Set the learner profile from the terminal. The study space has a richer version with a short diagnostic, but this one needs no browser.

1. Ask the user with the AskUserQuestion tool, one question, multiSelect, header "Ejercicios": which exercise families they want. Options:
   - "Recordar": opción múltiple y recuerdo libre. Retener y distinguir.
   - "Explicar": explicarlo con tus palabras, justificar una decisión, comparar dos diseños.
   - "Leer código": predecir qué hace un fragmento, encontrar el error, revisar un cambio. Entiende código escrito por la IA sin escribir código.
2. Ask a second question, single select, header "Nivel": básico, medio, avanzado.
3. Map the answers to modalities: Recordar = `opcion-multiple`, `recuerdo-libre`; Explicar = `explica`, `justifica`, `compara`; Leer código = `predice-salida`, `encuentra-error`, `revisa-cambio`. If the user wants fewer, accept their wording (for example "no quiero recuerdo libre") and remove those.
4. Save with `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" profile set`, JSON on stdin, for example `{"modalities": ["explica","justifica","compara","predice-salida"], "level": "medio"}`. Use `level` values `basico`, `medio` or `avanzado`.
5. Reply with one line listing the modalities saved and that lessons from the next commit will use them. Mention that the study space shows the profile after `/study`.
