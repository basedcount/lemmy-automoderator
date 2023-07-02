import { LemmyHttp, Login } from 'lemmy-js-client';

//Logs in through the Lemmy JS client, returns a client and its JWT
export async function login(username: string, password: string, instance: string) {
    const client: LemmyHttp = new LemmyHttp('https://' + instance);
    const loginForm: Login = {
        username_or_email: username,
        password: password,
    };

    const jwt = (await client.login(loginForm)).jwt;

    return { client, jwt };
}

//Returns a list of actor_ids (https://INSTANCE/u/USERNAME) of all the moderators
export async function getModList(client: LemmyHttp, communityName: string) {
    const community = await client.getCommunity({ name: communityName });
    
    const mods = community.moderators.map(mod => ({
        actor_id: mod.moderator.actor_id,
        community_name: community.community_view.community.name
    })) satisfies Moderator[];

    return mods;
}

export interface Moderator {
    actor_id: string;
    community_name: string;
}