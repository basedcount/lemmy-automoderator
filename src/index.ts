import 'dotenv/config';
import LemmyBot from 'lemmy-bot';
import Database from 'better-sqlite3';
import { setUpDb, addCommunity, getCommunity, updateCommunityConfig } from './db';

import { readFileSync } from 'fs'; //TEMP


const USERNAME = process.env.LEMMY_USERNAME || '';
const PASSWORD = process.env.LEMMY_PASSWORD || '';
const INSTANCE = process.env.LEMMY_INSTANCE || '';
const DATABASE = 'db.sqlite3';

const db = new Database(DATABASE);
db.pragma('journal_mode = WAL');

if (USERNAME === '' || PASSWORD === '' || INSTANCE === '') {
    throw new Error('Undefined username, password or instance. Check your .env file.');
}

const bot = new LemmyBot({
    credentials: { username: USERNAME, password: PASSWORD },
    connection: { secondsBetweenPolls: 2 },
    instance: INSTANCE,
    dbFile: DATABASE,
    federation: 'local',
    handlers: {
        privateMessage: async ({
            messageView: { private_message: { content }, creator: { id: creator_id, name } },
            botActions: { sendPrivateMessage, getCommunityId, isCommunityMod, getUserId },
            preventReprocess
        }) => {
            try {
                //TODO: change this logic. Parse first, get community from there. User message will only contain JSON

                console.log(`Message received from u/${name}`);
                const message = content.split(/\r?\n|\r|\n/);
                const submittedName = message[0];
                const community_id = await getCommunityId({ instance: INSTANCE, name: submittedName });

                if (community_id == null) {         //Check if the community exists
                    await sendPrivateMessage({ content: `No community named "${submittedName}" was found `, recipient_id: creator_id });
                    console.log(`Denied: Unknown community: ${submittedName}`);
                    return;
                }

                if (!await isCommunityMod({ person_id: creator_id, community_id })) {   //Check if the requester is a moderator
                    await sendPrivateMessage({ content: `You aren't a moderator in "${submittedName}". Only moderators can edit a community's AutoMod configuration.`, recipient_id: creator_id });
                    console.log(`Denied: User u/${submittedName} is not a mod in c/${submittedName}`);
                    return;
                }

                const own_id = await getUserId({ instance: INSTANCE, name: USERNAME }) as number;
                if (!await isCommunityMod({ person_id: own_id, community_id })) {       //Check if the bot is among the mods
                    await sendPrivateMessage({ content: `This account is not a moderator in "${submittedName}". AutoMod can only be enabled in communities where it is a mod.`, recipient_id: creator_id });
                    console.log(`Denied: AutoMod not activated in c/${submittedName}`);
                    return;
                }

                let communityDbId = getCommunity(db, submittedName, community_id);

                if (communityDbId === null) {   //Check if the bot is already monitoring the community, if not add it to the database
                    addCommunity(db, submittedName, community_id);
                    communityDbId = getCommunity(db, submittedName, community_id) as number;
                }

                await updateCommunityConfig(communityDbId, message.slice(1).join("\n"));  //Parse JSON and update the database configuration for the community

                await sendPrivateMessage({ content: 'Configurations updated succesfully!', recipient_id: creator_id }); //Send confirmation message
                console.log(`Approved: u/${name} changed the configuration of c/${submittedName}`);
            } catch (e) {
                await sendPrivateMessage({ content: 'Error while parsing AutoMod configuration.', recipient_id: creator_id });
                console.log(e);
            } finally {
                preventReprocess()
            }
        },

        /*

        mention: async ({
            mentionView: { creator: { id }, community: { id: community_id }, comment: { content }, post: { id: post_id } },
            botActions: { createComment, featurePost, lockPost, isCommunityMod },
            preventReprocess
        }) => {
            if (!await isCommunityMod({ person_id: id, community_id })) return;

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
        //I probably can't count reports, but I can automatically approve anything posted by whitelisted users
        commentReport: async ({

        }) => {

        },

        postReport: async ({

        }) => {

        },

        */
    },
});

// setUpDb(db);
// bot.start();
updateCommunityConfig(1, temp());


function temp(): string {
    return readFileSync('./test/mention.json').toString();
}
