# Journal des décisions d'architecture (ADR)

> Une décision = un fichier `NNNN-titre-court.md`. Ne jamais réécrire un ADR accepté : on le marque « remplacé par ADR-XXXX ».
> Matière déjà latente dans le dev-log (full Next.js, Tiptap, pg-boss, Better Auth, AC maison…) → à formaliser ici.
> Sert directement **C2.4.1** (traçabilité et justification des choix).

## Index
| N° | Titre | Statut | Date |
|----|-------|--------|------|
| 0000 | (gabarit) | — | — |
| 0001 | Ligatures non dépliées dans le moteur de liaison (Aho-Corasick) | accepté | 2026-07-03 |
| 0002 | Full Next.js (monolithe, pas de backend séparé, pas de tRPC) | accepté | 2026-07-02 |
| 0003 | Tiptap comme éditeur riche | accepté | 2026-07-02 |
| 0004 | Better Auth pour l'authentification email + mot de passe | accepté | 2026-07-03 |
| 0005 | pg-boss comme implémentation de JobQueue (+ policy « short ») | accepté | 2026-07-03 |
| 0006 | Prisma 7 (générateur `prisma-client` + adapter-pg) | accepté | 2026-07-10 |
| 0007 | Exclusion des wrappers SDK fins du calcul de couverture Vitest | accepté | 2026-07-11 |
| 0008 | `node:24-slim` (Debian/glibc) comme base des images Docker | accepté | 2026-07-12 |
| 0009 | Validation serveur du contenu Tiptap via le schéma ProseMirror réel | accepté | 2026-07-14 |
| 0010 | Surlignage des liaisons : re-scan côté client plutôt que positions serveur persistées | accepté | 2026-07-16 |
| 0011 | Mentions manuelles @ : réconciliation synchrone, coexistence avec AUTO | accepté | 2026-07-17 |
| 0012 | Graphe de relations : Cytoscape.js dès le MVP (pas de migration à prévoir) | accepté | 2026-07-17 |
