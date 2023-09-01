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
            mentionView: { creator: { id }, community: { id: communityId }, comment: { content, id: commentId }, post: { id: postId } },
            botActions: { createComment, featurePost, lockPost, isCommunityMod },
            preventReprocess
        }) => {
            if (!await isCommunityMod({ person_id: id, community_id: communityId })) return;

            const rules = getMentionRules(db, communityId);

            for (const rule of rules) {
                if (content.includes(rule.command)) {
                    if (rule.action === 'lock') {
                        lockPost({ locked: true, post_id: postId });
                    } else if (rule.action === 'pin') {
                        featurePost({ feature_type: 'Community', featured: true, post_id: postId });
                    }

                    if (rule.message !== null) {
                        await createComment({ content: rule.message, post_id: postId, parent_id: commentId });
                    }

                    break;
                }
            }

            preventReprocess();
        },

        comment: async ({
            commentView: {
                comment: { id, content: body },
                community: { id: communityId },
                post: { id: postId },
                creator: { actor_id: actorId, id: personId }
            },
            botActions: { createComment, removeComment, isCommunityMod },
            preventReprocess
        }) => {
            const isPosterMod = await isCommunityMod({ community_id: communityId, person_id: personId });
            const rules = getCommentRules(db, actorId, communityId, isPosterMod);

            for (const rule of rules) {
                if (rule.type === 'exact' && body.includes(rule.match as string)) {
                    removeComment({ comment_id: id, reason: rule.removal_reason !== null ? rule.removal_reason : undefined });

                    if (rule.message !== null) {
                        createComment({ post_id: postId, content: rule.message });
                    }

                    break;
                } else if (rule.type === 'regex' && (rule.match as RegExp).test(body)) {
                    removeComment({ comment_id: id, reason: rule.removal_reason !== null ? rule.removal_reason : undefined });

                    if (rule.message !== null) {
                        createComment({ post_id: postId, content: rule.message });
                    }

                    break;
                }
            }

            preventReprocess();
        },

        post: async ({
            postView: {
                post: { id, body, name: title, url },
                community: { id: communityId },
                creator: { actor_id: actorId, id: personId }
            },
            botActions: { createComment, removePost, isCommunityMod },
            preventReprocess
        }) => {
            const isPosterMod = await isCommunityMod({ community_id: communityId, person_id: personId });
            const rules = getPostRules(db, actorId, communityId, isPosterMod);

            for (const rule of rules) {
                //Field to be checked: body | url | title
                const field = (() => {
                    if (rule.field === 'body') return body;
                    else if (rule.field === 'link') return url;
                    if (rule.field === 'title') return title;
                })();

                if (field !== undefined) {
                    if (rule.type === 'exact' && field.includes(rule.match as string)) {
                        removePost({ post_id: id, reason: rule.removal_reason !== null ? rule.removal_reason : undefined });

                        if (rule.message !== null) {
                            createComment({ post_id: id, content: rule.message });
                        }

                        break;
                    } else if (rule.type === 'regex' && (rule.match as RegExp).test(field)) {
                        removePost({ post_id: id, reason: rule.removal_reason !== null ? rule.removal_reason : undefined });

                        if (rule.message !== null) {
                            createComment({ post_id: id, content: rule.message });
                        }

                        break;
                    }
                }
            }

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

setUpDb(db);
bot.start();