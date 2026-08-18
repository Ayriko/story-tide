# ADR-0025 — Envoi d'e-mails : SMTP OVH via nodemailer, derrière un port `Mailer`

- **Statut** : accepté
- **Date** : 2026-08-17 (montage SMTP précisé le 2026-08-18)
- **Décideur** : Aymeric (MOE)

## Contexte et problème

KAN-52 : deux bêta-testeurs se sont retrouvés bloqués hors de leur compte, sans
aucun moyen de réinitialiser leur mot de passe. Le déblocage s'est fait à la
main, ce qui n'est pas tenable et fait de l'oubli de mot de passe la pire
friction possible pour un produit en bêta.

Better Auth sait déjà tout faire côté jeton (`requestPasswordReset` /
`resetPassword`, jeton à usage unique, expiration configurable) : il ne manque
que le moyen d'acheminer le lien. Or **l'application n'a jamais envoyé le moindre
e-mail** — c'est écrit noir sur blanc en tête de `src/lib/auth.ts` (« pas de SMTP
au MVP »). Cette décision fonde donc la première brique de messagerie du produit,
et pas seulement le flux de réinitialisation : la vérification d'adresse, les
notifications et le changement d'e-mail (KAN-55) s'appuieront dessus.

Contrainte de départ : le domaine `storytide.fr` est chez OVH, avec une adresse
`contact@storytide.fr` déjà opérationnelle comme canal de retours bêta (KAN-45).
Un serveur SMTP est donc disponible sans rien souscrire de plus.

## Options envisagées

- **A — Service tiers d'envoi transactionnel** (Resend, Postmark, Brevo…) :
  écartée. API HTTP simple et bonne délivrabilité, mais introduit une dépendance
  externe hors de la stack actée, un compte et une clé à gérer, et surtout fait
  transiter des adresses e-mail d'utilisateurs par un sous-traitant qu'il
  faudrait alors documenter au registre RGPD et dans les mentions légales. Coût
  de conformité disproportionné pour un seul type de message.
- **B — Implémentation SMTP maison** (socket + STARTTLS à la main) : écartée.
  Zéro dépendance, mais réécrire un client SMTP correct (TLS, encodages,
  multipart, gestion d'erreurs) est du code fragile que personne n'a demandé —
  contraire au principe de simplicité du projet.
- **C — `nodemailer` sur le SMTP OVH existant** (retenue) : une dépendance
  unique, mûre et sans dépendance transitive, sur une infrastructure déjà
  payée et déjà utilisée. Aucune donnée utilisateur ne sort de chez OVH, qui
  héberge déjà la base et le stockage — le périmètre RGPD est inchangé.

`nodemailer` ne figure pas dans la stack actée du projet : cet ADR est
précisément là pour tracer cet ajout, validé explicitement avec Aymeric avant
implémentation.

## Décision

Un **port `Mailer`** (`src/lib/mail/types.ts`) expose une seule opération,
`send({ to, subject, text, html })`. Les appelants ne connaissent que cette
interface, jamais `nodemailer` — même patron ports & adapters que `Storage`
(ADR-0017) et `JobQueue` (ADR-0005), conformément à la règle d'architecture du
projet.

Trois pièces derrière ce port :

- `smtp-adapter.ts` — wrapper `nodemailer` (`createTransport` + `sendMail`),
  **exclu de la couverture** au titre d'ADR-0007, comme `s3-adapter.ts` et
  `pg-boss-adapter.ts` : aucune logique métier, uniquement le branchement du SDK.
- `memory-adapter.ts` — double en mémoire, avec accesseurs d'inspection, pour
  les tests unitaires.
- `index.ts` — composition root, qui choisit l'adaptateur selon `MAIL_TRANSPORT`.

**L'expéditeur n'est pas un paramètre d'appel** mais une donnée de configuration
de l'adaptateur (`MAIL_FROM`) : aucun code appelant ne peut usurper l'adresse
d'envoi du produit.

Le contenu du message est produit par une **fonction pure** testée
(`reset-password-email.ts`), qui construit les deux formes — texte brut et HTML
sobre à la charte, styles en ligne, **aucune ressource distante** (donc aucun
pixel de suivi, rien qu'un client puisse bloquer). Le lien est échappé avant
injection dans le HTML, alors même qu'il provient de Better Auth et non d'une
saisie : une source « sûre aujourd'hui » ne doit pas devenir une hypothèse de
sécurité. La durée de validité annoncée dans le message est dérivée de la même
constante que celle passée à Better Auth (`RESET_LINK_VALIDITE_SECONDES`), et un
test verrouille les deux ensemble — annoncer une durée fausse serait un bug de
confiance.

`MAIL_TRANSPORT` (`smtp` par défaut, `memory` en e2e) existe pour une raison
précise : **aucun run automatisé ne doit faire partir un message réel**. Le
défaut reste `smtp`, pour qu'un oubli de configuration échoue bruyamment au lieu
d'avaler silencieusement les envois — un envoi silencieusement perdu en
production serait bien pire qu'une erreur visible.

## Montage retenu : le compte authentifié n'est pas l'expéditeur

Découvert au premier envoi réel (2026-08-17) : `contact@storytide.fr`, l'adresse
publique du produit et canal de retours bêta depuis KAN-45, est un **alias**, pas
une boîte. Un alias n'a pas de mot de passe et ne peut donc pas authentifier un
envoi — `535 5.7.1 Authentication failed`, sur 465 comme sur 587, avec des MX
(`mx0-3.mail.ovh.net`) et un SPF (`v=spf1 include:mx.ovh.com ~all`) pourtant
corrects.

Trois issues ont été pesées (arbitrage Aymeric, 2026-08-18) :

- **Créer une vraie boîte `contact@`** : écartée pour l'instant. Il faudrait
  d'abord supprimer l'alias pour libérer l'adresse, donc interrompre la réception
  des retours bêta le temps de reparamétrer une redirection — un risque inutile à
  trois jours du dépôt.
- **Basculer l'expéditeur sur `admin@`** : écartée. `admin@` est une adresse
  d'administration ; la voir arriver dans la boîte d'un bêta-testeur est un
  contresens produit, alors que `contact@` est l'adresse qu'ils connaissent déjà.
- **Dissocier authentification et expéditeur** (retenue) : on s'authentifie sur
  `admin@storytide.fr` (seule boîte réelle) et on affiche
  `MAIL_FROM=contact@storytide.fr`. SMTP le permet nativement, et le montage
  était déjà éprouvé en production depuis le 2026-08-13 par le « Envoyer en tant
  que » de Gmail, qui utilise exactement les mêmes réglages — donc zéro
  changement côté OVH, et un risque de délivrabilité déjà mesuré en conditions
  réelles.

Conséquence de configuration : `SMTP_USER` (`admin@`) et `MAIL_FROM` (`contact@`)
**diffèrent volontairement**. C'est contre-intuitif et se ferait « corriger » par
erreur — d'où l'avertissement explicite dans `.env.example` et dans
`docs/manuels/deploiement.md`. La bascule ultérieure vers une vraie boîte
`contact@` ne coûtera que ces deux variables et un redéploiement : le port
`Mailer` n'a pas à bouger.

## Conséquences

- **Positives** : le flux de réinitialisation devient autonome, deux
  utilisateurs bloqués débloqués sans intervention manuelle ; la brique est
  réutilisable telle quelle par KAN-55 (changement d'adresse) et par une future
  vérification d'e-mail ; aucun sous-traitant supplémentaire, périmètre RGPD
  inchangé ; le port permet de tester tout le flux sans serveur SMTP, et de
  changer de fournisseur en écrivant un seul adaptateur.
- **Négatives / à surveiller** : la **délivrabilité** repose sur la
  configuration DNS du domaine — SPF est en place, mais DKIM et DMARC ne sont
  pas encore vérifiés pour `storytide.fr` ; un message de réinitialisation
  classé en indésirable est fonctionnellement équivalent à une panne, et
  l'utilisateur n'a aucun moyen de le savoir. À vérifier après la première
  livraison réelle, et à surveiller sur les prochains retours bêta.
- **Point de vigilance découvert au premier envoi réel (2026-08-17)** : Better
  Auth appelle `sendResetPassword` via `runInBackgroundOrAwait`. Une erreur
  d'envoi **ne remonte donc pas** jusqu'au `catch` de
  `requestPasswordResetAction` — elle est journalisée par Better Auth
  (`Failed to run background task: ... 535 5.7.1 Authentication failed`), pas
  sous le préfixe `[auth]` de l'application. Le `console.error` de l'action
  reste utile (il couvre les échecs synchrones de l'appel lui-même, base
  injoignable par exemple), mais **ce n'est pas là qu'apparaît une panne SMTP**.
  Conséquence pratique : la supervision des logs doit viser les deux motifs, et
  `docs/manuels/deploiement.md` donne les commandes exactes — une doc qui
  n'aurait cherché que `[auth]` n'aurait jamais rien montré.
- **Contrainte de sécurité qui a guidé le code** : la réponse de la demande de
  réinitialisation est **strictement identique** que l'adresse corresponde ou non
  à un compte, y compris quand l'envoi échoue (OWASP A07, non-énumération).
  C'est ce qui explique qu'une panne d'envoi ne produise aucun message d'erreur
  côté utilisateur : distinguer les cas rendrait le formulaire bavard sur
  l'existence des comptes.

## Compétence(s) servie(s)

C2.2.1 (architecture — nouveau port, adaptateurs interchangeables, composition
root isolée) ; C2.2.2 (tests — logique de message pure et testée, double en
mémoire pour les tests et l'e2e) ; C2.2.3 (sécurité — non-énumération A07, aucun
secret dans le dépôt, échappement du lien) ; C2.4.1 (traçabilité de l'ajout
d'une dépendance hors stack actée).
