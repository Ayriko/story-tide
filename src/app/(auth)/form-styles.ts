// Classes Tailwind partagees entre login-form et register-form (memes champs,
// meme rendu). Evite la duplication sans introduire d'abstraction de composant.
export const inputClassName =
  "h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:outline-zinc-50";

export const labelClassName = "text-sm font-medium text-zinc-900 dark:text-zinc-100";

export const fieldErrorClassName = "text-sm text-red-700 dark:text-red-400";

export const formErrorClassName =
  "rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200";

export const submitButtonClassName =
  "inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus-visible:outline-zinc-50";
