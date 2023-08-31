import 'dotenv/config';
import LemmyBot from 'lemmy-bot';
import Database from 'better-sqlite3';
import {
    setUpDb, addCommunity, getCommunity,
    addPostRule, addCommentRule, addMentionRule, addExceptionRule,
    getPostRules, getCommentRules, getMentionRules
} from './db';
import { parse } from './parser';

const USERNAME = process.env.LEMMY_USERNAME || '';
const PASSWORD = process.env.LEMMY_PASSWORD || '';
const INSTANCE = process.env.LEMMY_INSTANCE || '';
const DATABASE = 'db.sqlite3';

let ownId: number;

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
            messageView: { private_message: { content }, creator: { id: creatorId, name } },
            botActions: { sendPrivateMessage, getCommunityId, isCommunityMod, getUserId },
            preventReprocess
        }) => {
            try {
                const userInput = parse(content);
                const communityName = userInput.community;
                const communityId = await getCommunityId({ instance: INSTANCE, name: communityName });

                /*  PRELIMINARY CHECKS  */

                //Does the community exist?
                if (communityId == null) {
                    await sendPrivateMessage({ content: `No community named "${communityName}" was found `, recipient_id: creatorId });
                    console.log(`Denied: Unknown community: c/${communityName}`);
                    return;
                }

                //Is the requester a moderator in the community?
                if (!await isCommunityMod({ person_id: creatorId, community_id: communityId })) {
                    await sendPrivateMessage({ content: `You aren't a moderator in "${communityName}". Only moderators can edit a community's AutoMod configuration.`, recipient_id: creatorId });
                    console.log(`Denied: User u/${name} is not a mod in c/${communityName}`);
                    return;
                }

                //Only runs on startup, fetch the bot's ID
                if (ownId === undefined) {
                    ownId = await getUserId({ instance: INSTANCE, name: USERNAME }) as number;
                }

                /*
                    NOTE:
                    Currently there's no way of making an account a mod if it comments in the target community,
                    so this check makes little sense.
                    In the future, before failing, this should cause the bot to comment under the top post and reply with a link to said comment.
                */

                //Is the bot a moderator in the community?
                if (!await isCommunityMod({ person_id: ownId, community_id: communityId })) {
                    await sendPrivateMessage({ content: `AutoMod is not a moderator in "${communityName}". AutoMod can only be enabled in communities where it is a mod.`, recipient_id: creatorId });
                    console.log(`Denied: AutoMod not activated in c/${communityName}`);
                    return;
                }

                //Check if the bot is already monitoring the community, if not add it to the database
                let communityInternalId = getCommunity(db, communityName, communityId);
                if (communityInternalId === null) {
                    communityInternalId = addCommunity(db, communityName, communityId);
                }

                /*  CHECKS PASSED, CONFIGURATION CAN BE INSERTED  */

                if (userInput.rule === 'post') {
                    addPostRule(db, userInput, communityInternalId);
                    console.log(`Success: post rule in c/${communityName}`);
                } else if (userInput.rule === 'comment') {
                    addCommentRule(db, userInput, communityInternalId);
                    console.log(`Success: comment rule in c/${communityName}`);
                } else if (userInput.rule === 'mention') {
                    addMentionRule(db, userInput, communityInternalId);
                    console.log(`Success: mention rule in c/${communityName}`);
                } else if (userInput.rule === 'exception') {
                    addExceptionRule(db, userInput, communityInternalId);
                    console.log(`Success: exception rule in c/${communityName}`);
                }

                await sendPrivateMessage({ content: 'Rule successfully added.', recipient_id: creatorId });
            } catch (e) {
                if (e === 'invalid_schema') {
                    await sendPrivateMessage({ content: 'The provided configuration is invalid. Make sure to consult the bot\'s documentation to avoid any mistakes.', recipient_id: creatorId });
                    console.log('Error: user submitted an invalid schema');

                } else {
                    await sendPrivateMessage({ content: 'Error while processing AutoMod configuration. Please try again.', recipient_id: creatorId });
                    console.log(e);

                }

            } finally {
                preventReprocess()
            }
        },

        mention: async ({
            mentionView: { creator: { id }, community: { id: communityId }, comment: { content }, post: { id: postId } },
            botActions: { createComment, featurePost, lockPost, isCommunityMod },
            preventReprocess
        }) => {
            if (!await isCommunityMod({ person_id: id, community_id: communityId })) return;

            //Fetch all configs for the community (if len == 0 return)

            //For each lock config, check if matches lock command and lock

            //For each pin config, check if matches pin command and pin

            //Don't reply if msg in config is empty

            preventReprocess();
        },

        comment: async ({
            commentView: {
                comment: { id, content: body },
                community: { id: communityId },
                creator: { actor_id: actorId }
            },
            botActions: { createComment, removeComment },
            preventReprocess
        }) => {
            //Fetch all configs for the community (if len == 0 return)

            //For each config line run regex check or exact check

            //If whitelisted user (first check) return

            preventReprocess();
        },


        post: async ({
            postView: {
                post: { id, body, name: title, url },
                community: { id: communityId },
                creator: { actor_id: actorId }
            },
            botActions: { createComment, removePost },
            preventReprocess
        }) => {
            //Fetch all configs for the community (if len == 0 return)

            //For each config line run check title, body, url

            //If whitelisted user (first check) return

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
    },
});

// setUpDb(db);
// bot.start();
console.log('\nPost:\n', getPostRules(db, 'Nerd02', 3, true));
console.log('\nComment:\n', getCommentRules(db, 'Nerd02', 3, true));
console.log('\nMention:\n', getMentionRules(db, 3));