// GET /invite : redirige vers Discord pour ajouter Phenix à un serveur.
// Une route plutôt qu'un lien écrit dans la page : la page d'accueil reste statique,
// et DISCORD_CLIENT_ID est lu dans l'environnement du conteneur, pas figé au build.
import { connection } from "next/server";
import { botInviteUrl } from "@/lib/discord";

export async function GET(request: Request) {
    await connection();
    // ?guild=<id> : Discord présélectionne ce serveur (liens de la page /servers)
    const guild = new URL(request.url).searchParams.get("guild");
    const url = botInviteUrl(guild && /^\d{17,20}$/.test(guild) ? guild : undefined);
    if (!url) {
        return new Response("Lien d'invitation indisponible : DISCORD_CLIENT_ID n'est pas défini pour le panel.", {
            status: 503,
            headers: { "content-type": "text/plain; charset=utf-8" },
        });
    }
    return Response.redirect(url, 302);
}
