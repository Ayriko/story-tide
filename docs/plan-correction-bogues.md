# Plan de correction des bogues — C2.3.2

> Alimenté par les anomalies/régressions détectées en recette.

## SLA / priorisation

- **P0** (bloquant : perte de données, faille de sécurité, prod down) : corrigé sous 24 h.
- **P1** (fonctionnalité majeure dégradée) : corrigé sous 72 h.
- **P2** (mineur, cosmétique) : planifié au jalon suivant.

Processus : détection → qualification (description, impact, reproduction) →
priorisation → diagnostic → correctif **+ test unitaire de non-régression** →
recette → déploiement. Alimenté par les issues GitHub (label `bug`) — pas encore
de repo GitHub actif à ce stade (remote configuré, pas d'issues créées).

| ID bug | Origine (TST-###) | Sévérité | Analyse cause | Correctif | Statut |
|---|---|---|---|---|---|
| BUG-001 | TST-AUT-007 | P1 | Après une erreur de soumission sur `/login` ou `/register` (mauvais mot de passe, e-mail déjà pris, champ manquant), **tous les champs du formulaire se vidaient**, y compris ceux correctement remplis. Cause : React 19 réinitialise les champs non contrôlés d'un `<form action={formAction}>` dès que la fonction d'action **se résout**, même si elle renvoie un état d'erreur — pas seulement en cas de succès (confirmé via issues GitHub React #29034 et #31649). | `src/actions/auth.ts` renvoie désormais les valeurs soumises (`values: { name?, email? }`, **jamais** le mot de passe) à chaque retour d'erreur ; `login-form.tsx`/`register-form.tsx` réappliquent ces valeurs via `defaultValue` sur les champs concernés. Décision produit associée : le mot de passe n'est jamais ré-affiché après une erreur (convention GitHub/GitLab), validée avec Aymeric. | ✅ corrigé + test de non-régression `login-form.test.tsx` (« réaffiche l'e-mail saisi après une erreur, mais jamais le mot de passe ») + validé manuellement par Aymeric |
| BUG-002 | TST-ENT-011, TST-SEC-014 | P1 | Remonté en test manuel le 2026-07-21 : coller un texte externe (Obsidian) dans l'éditeur d'entité faisait échouer **toute la sauvegarde** avec « Contenu invalide. », sans rapport apparent avec la cause réelle. Deux symptômes de la même famille (contenu HTML externe collé, jamais rencontré à la frappe manuelle) : (1) un wikilien converti en `<a href="…">` avec un `href` relatif (parfois avec espaces) échouait `isSafeHttpUrl` (URL `http(s)` absolue exigée) côté validation serveur, qui rejette alors le document entier plutôt que le seul attribut fautif ; (2) un retour à la ligne rendu en `<br>` (au lieu d'un paragraphe distinct) fondait deux lignes du texte source en un seul paragraphe ProseMirror. | (1) Extension `SafeLink` (`src/lib/tiptap-extensions.ts`) : retire la mark `link` dès le parsing (frappe/collage) si `isSafeHttpUrl` (déplacée dans `src/lib/url-safety.ts`, source unique de vérité avec la validation serveur) échoue — le texte de l'ancre est conservé, la validation serveur reste inchangée et non contournable. (2) `splitParagraphsOnBreaks` (`src/lib/tiptap-paste.ts`), câblée via `transformPastedHTML` : scinde un `<p>` contenant des `<br>` en paragraphes distincts au collage (DOMParser, pas de regex), sans paragraphe vide pour des `<br>` consécutifs ou en fin de bloc. | ✅ corrigé + tests de non-régression `tiptap-extensions.test.ts` (6 cas `SafeLink` + cas `splitParagraphsOnBreaks` + intégration collage Obsidian complet), gates complets (lint/tsc/322 tests/build/9 e2e) — vérification manuelle Aymeric en attente |
