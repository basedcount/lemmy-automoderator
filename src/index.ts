import 'dotenv/config';
import LemmyBot from 'lemmy-bot';
import { login, getModList, Moderator } from './api';
import cron from 'node-cron';

const USERNAME = process.env.LEMMY_USERNAME || '';
const PASSWORD = process.env.LEMMY_PASSWORD || '';
const INSTANCE = process.env.LEMMY_INSTANCE || '';
const DATABASE = 'db.sqlite3';
let mods: Moderator[] = [];

const communities = ['pcm'];    //Real implementation: store these in the local sqlite database

if (USERNAME === '' || PASSWORD === '' || INSTANCE === '') {
    throw new Error('Undefined username, password or instance. Check your .env file.');
}

cron.schedule('0 * * * *', refreshMods);    //Refresh mod list every hour

run();

async function run() {
    await refreshMods();

    const bot = new LemmyBot({
        credentials: {
            username: USERNAME,
            password: PASSWORD,
        },
        instance: INSTANCE,
        connection: {
            secondsBetweenPolls: 2,
        },
        federation: 'local',    //Do not access content outside of the local server
        handlers: {
            comment: async ({
                commentView: {
                    comment: { id: commentId, content: commentText },
                    creator: { id: userId, name: userName },
                    post: { id: postId, name: postTitle }
                },
                botActions: {
                    createComment,
                    reportComment,
                    reportPost,
                    removeComment,
                    lockPost,
                    sendPrivateMessage,
                    resolveCommentReport
                    // featurePost (pin post - doesn't appear to work)
                }
            }) => {
                console.log(`${userName} says: "${commentText}"`);
                console.log('Mods:', mods);
            },
            //post (check submission title, link...)
            //privateMessage (configuration if moderator)
            //mention (do stuff if mentioned by mod)
            //commentReport (if possible count report, remove if has X more report) 
            //postReport (if possible count report, remove if has X more report) 
            //privateMessageReport (if possible count report, remove if has X more report) 
            //modLockPost ("Post locked because...")
            //modBanFromCommunity ("You have been banned because...")
        },
        dbFile: DATABASE
    });

    bot.start();
}

//Login and retrieve the most recent mod list
async function refreshMods() {
    try{
        const { client } = await login(USERNAME, PASSWORD, INSTANCE);
        
        let localMods: Moderator[] = [];
        for (const community of communities) {
            const modList = await getModList(client, community);

            localMods = localMods.concat(modList);
        }
        
        mods = localMods;
    } catch(e) {
        console.log('Error while refreshing mod list:', e);
    }
}
