import { cache } from "react";
import { getMe } from "./api";

/** Utilisateur connecté : l'en-tête et la page le lisent tous les deux, un seul appel à /me par requête */
export const getViewer = cache(getMe);

// Réexportés pour les composants serveur ; les composants client importent ./names directement
export { displayName, initials } from "./names";