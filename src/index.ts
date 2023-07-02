import 'dotenv/config';
import LemmyBot from 'lemmy-bot';
import cron from 'node-cron';
import Database from 'better-sqlite3';
import { login, getModList, Moderator } from './api';

const USERNAME = process.env.LEMMY_USERNAME || '';
const PASSWORD = process.env.LEMMY_PASSWORD || '';
const INSTANCE = process.env.LEMMY_INSTANCE || '';
const DATABASE = 'db.sqlite3';

const db = new Database(DATABASE);
db.pragma('journal_mode = WAL');

const communities = ['pcm'];    //Real implementation: store these in the local sqlite database
let mods: Moderator[] = [];


if (USERNAME === '' || PASSWORD === '' || INSTANCE === '') {
    throw new Error('Undefined username, password or instance. Check your .env file.');
}

cron.schedule('0 * * * *', refreshMods);    //Refresh mod list every hour

run();

async function run() {
    await refreshMods();

    const bot = new LemmyBot({
        credentials: { username: USERNAME, password: PASSWORD },
        connection: { secondsBetweenPolls: 2 },
        instance: INSTANCE,
        dbFile: DATABASE,
        federation: 'local',
        handlers: {
            privateMessage: async ({
                messageView: { private_message: { id, content }, creator: { actor_id, id: creator_id } },
                botActions: { sendPrivateMessage, getCommunityId },
                preventReprocess
            }) => {
                try {
                    const submittedName = content.split(/\r?\n|\r|\n/)[0];

                    if (communities.includes(submittedName)) {
                        if (!isMod(actor_id, submittedName)) {
                            await sendPrivateMessage({ content: `You aren't a moderator in ${submittedName}. Only moderators can edit a community's AutoMod configuration. `, recipient_id: creator_id });
                            return;
                        }
                    } else {
                        const id = await getCommunityId({ instance: INSTANCE, name: submittedName });
                        if (id == null) {
                            await sendPrivateMessage({ content: `No community named ${submittedName} was found. `, recipient_id: creator_id });
                            return;
                        }

                        communities.push(submittedName);
                        await refreshMods();

                        if (!isMod(actor_id, submittedName)) {
                            await sendPrivateMessage({ content: `You aren't a moderator in ${submittedName}. Only moderators can edit a community's AutoMod configuration. `, recipient_id: creator_id });
                            return;
                        }
                    }

                    //Update configuration by writing in database

                    await sendPrivateMessage({ content: 'Configurations updated succesfully!', recipient_id: creator_id });
                } catch (e) {
                    await sendPrivateMessage({ content: 'Error while parsing AutoMod configuration.', recipient_id: creator_id });
                    console.log(e);
                } finally {
                    preventReprocess()
                }
            },

            mention: async ({
                mentionView: { creator: { actor_id }, community: { name: community_name }, comment: { content }, post: { id: post_id } },
                botActions: { createComment, featurePost, lockPost },
                preventReprocess
            }) => {
                if (!isMod(actor_id, community_name)) return;

                //Fetch all configs for the community (if len == 0 return)

                //For each lock config, check if matches lock command and lock

                //For each pin config, check if matches pin command and pin

                //Don't reply if msg in config is empty

                preventReprocess();
            },

            comment: async ({
                commentView: {
                    comment: { id, content: body },
                    community: { name: community_name },
                    creator: { name, instance_id }
                },
                botActions: { createComment, removeComment },
                preventReprocess
            }) => {
                //Fetch all configs for the community (if len == 0 return)

                //For each config line run regex check or exact check

                //If shadowbannned user remove, if whitelisted user (first check) return

                preventReprocess();
            },


            post: async ({
                postView: {
                    post: { id, body, name: title, url },
                    community: { name: community_name },
                    creator: { name, instance_id }
                },
                botActions: { createComment, removePost },
                preventReprocess
            }) => {
                //Fetch all configs for the community (if len == 0 return)

                //For each config line run check title, body, url

                //If shadowbannned user remove, if whitelisted user (first check) return

                preventReprocess();
            },

            //Not really sure how and if these two can be handled
            commentReport: async ({

            }) => {

            },

            postReport: async ({

            }) => {

            },
        },
    });

    bot.start();
}

//Login and retrieve the most recent mod list
//TODO: for each community, check if AutoMod is in the modlist (USERNAME). If not, send a warning PM to all moderators, remove community from community table (on delete cascade clears all configurations)
async function refreshMods() {
    try {
        const { client } = await login(USERNAME, PASSWORD, INSTANCE);

        let localMods: Moderator[] = [];
        for (const community of communities) {
            const modList = await getModList(client, community);

            localMods = localMods.concat(modList);
        }

        mods = localMods;
    } catch (e) {
        console.log('Error while refreshing mod list:', e);
    }
}

//Returns true if an actor is a moderator in a community
function isMod(actor_id: string, community_name: string): boolean {
    for (const mod of mods) {
        if (mod.actor_id === actor_id && mod.community_name === community_name) {
            return true;
        }
    }

    return false;
}