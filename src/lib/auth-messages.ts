// Messages du parcours d'authentification partages entre une Server Action et
// l'UI. Ils vivent ici, et non dans src/actions/auth.ts : un module marque
// "use server" ne peut exporter QUE des fonctions asynchrones - y exporter une
// constante casse le module entier a la compilation (constate le 2026-08-17).

// Reponse unique de la demande de reinitialisation, affichee que l'adresse
// corresponde ou non a un compte : ne jamais permettre de deduire l'existence
// d'un compte depuis ce formulaire (OWASP A07). Better Auth applique deja la
// meme politique cote endpoint - ce message est le pendant cote interface.
export const RESET_REQUEST_CONFIRMATION =
  "Si un compte existe pour cette adresse, un e-mail vient d'être envoyé.";
