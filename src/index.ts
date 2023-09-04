import 'dotenv/config';
import LemmyBot from 'lemmy-bot';
import Database from 'better-sqlite3';
import {
    setUpDb, addCommunity, getCommunity,
    addPostRule, addCommentRule, addMentionRule, addExceptionRule,
    getPostRules, getCommentRules, getMentionRules, isWhitelisted
} from './db';
import { parse } from './parser';

const USERNAME = process.env.LEMMY_USERNAME || '';
const PASSWORD = process.env.LEMMY_PASSWORD || '';
const INSTANCE = process.env.LEMMY_INSTANCE || '';
const DATABASE = 'db.sqlite3';
const OWN_ACTOR_ID = `https://${INSTANCE}/u/${USERNAME}`;

let ownId: number;

const db = new Database(DATABASE);
db.pragma('journal_mode = WAL');

if (USERNAME === '' || PASSWORD === '' || INSTANCE === '') {
    throw new Error('Undefined username, password or instance. Check your .env file.');
}

/*
    TODO:
    - change the handling of post.field, allow the input of multiple fields separated by a '+' sign. Add wrapper function, separate fields, call already existing handler for each field. Don't forget to edit TS interface (only JSON)
*/

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
                const errors = new Map<number, string>();
                let i = 1;
                for (const rule of userInput) {

                    //Check for schema matching
                    if (rule === null) {
                        errors.set(i++, 'Incorrect schema. The provided configuration doesn\'t match any known schema.');
                        continue;
                    }

                    const communityName = rule.community;
                    const communityId = await getCommunityId({ instance: INSTANCE, name: communityName });

                    /*  PRELIMINARY CHECKS  */

                    //Does the community exist?
                    if (communityId == null) {
                        errors.set(i++, `No community named "${communityName}" was found.`);
                        console.log(`Denied: Unknown community: c/${communityName}`);
                        continue;
                    }

                    //Is the requester a moderator in the community?
                    if (!await isCommunityMod({ person_id: creatorId, community_id: communityId })) {
                        errors.set(i++, `You aren't a moderator in "${communityName}". Only moderators can edit a community's AutoMod configuration.`);
                        console.log(`Denied: User u/${name} is not a mod in c/${communityName}`);
                        continue;
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
                        errors.set(i++, `AutoMod is not a moderator in "${communityName}". AutoMod can only be enabled in communities where it is a mod.`);
                        console.log(`Denied: AutoMod not activated in c/${communityName}`);
                        continue;
                    }

                    //Check if the bot is already monitoring the community, if not add it to the database
                    let communityInternalId = getCommunity(db, communityName, communityId);
                    if (communityInternalId === null) {
                        communityInternalId = addCommunity(db, communityName, communityId);
                    }

                    /*  CHECKS PASSED, CONFIGURATION CAN BE INSERTED  */

                    if (rule.rule === 'post') {
                        addPostRule(db, rule, communityInternalId);
                        console.log(`Success: post rule in c/${communityName}`);
                    } else if (rule.rule === 'comment') {
                        addCommentRule(db, rule, communityInternalId);
                        console.log(`Success: comment rule in c/${communityName}`);
                    } else if (rule.rule === 'mention') {
                        addMentionRule(db, rule, communityInternalId);
                        console.log(`Success: mention rule in c/${communityName}`);
                    } else if (rule.rule === 'exception') {
                        addExceptionRule(db, rule, communityInternalId);
                        console.log(`Success: exception rule in c/${communityName}`);
                    }
                }

                //Report results to user with a PM
                if (errors.size === 0 && userInput.length === 1) {
                    await sendPrivateMessage({ content: 'Rule successfully added.', recipient_id: creatorId });

                } else if (errors.size === 0) {
                    await sendPrivateMessage({ content: 'Rules successfully added.', recipient_id: creatorId });

                } else if (errors.size === userInput.length) {
                    if (userInput.length === 1) {
                        const errorMessage = `\n\nError:\n\n- ${errors.entries().next().value}`;

                        await sendPrivateMessage({ content: 'The rule wasn\'t added, the provided configuration is invalid. Make sure to consult the bot\'s documentation to avoid any mistakes.' + errorMessage, recipient_id: creatorId });

                    } else {
                        let errorMessage = `\n\nErrors:`;

                        for (const [key, value] of errors) {
                            errorMessage += `\n\n- Rule ${key}: ${value}`;
                        }

                        await sendPrivateMessage({ content: 'No rules were added, all of the provided configurations are invalid. Make sure to consult the bot\'s documentation to avoid any mistakes.' + errorMessage, recipient_id: creatorId });

                    }
                } else {
                    let errorMessage = `\n\nErrors:`;

                    for (const [key, value] of errors) {
                        errorMessage += `\n\n- Rule ${key}: ${value}`;
                    }

                    await sendPrivateMessage({ content: `Rules partially added. Some of the provided configurations were invalid.  Make sure to consult the bot\'s documentation to avoid any mistakes. \n\nThe remaining rules were succesfully added.` + errorMessage, recipient_id: creatorId });

                }
            } catch (e) {
                await sendPrivateMessage({ content: `Error while processing AutoMod configuration, please try again. If the issue persists, consider reporting this to the developer.\n\nError code: ${e}`, recipient_id: creatorId });
                console.log(e);

            } finally {
                preventReprocess()
            }
        },

        mention: async ({
            mentionView: { creator: { id, name: userName, actor_id: actorId }, community: { id: communityId, name: communityName }, comment: { content, id: commentId }, post: { id: postId } },
            botActions: { createComment, featurePost, lockPost, isCommunityMod },
            preventReprocess
        }) => {
            if (actorId === OWN_ACTOR_ID) return;
            if (!await isCommunityMod({ person_id: id, community_id: communityId })) return;

            const rules = getMentionRules(db, communityId);

            for (const rule of rules) {
                if (content.includes(rule.command)) {
                    if (rule.message !== null) {
                        try {
                            await createComment({ content: rule.message, post_id: postId, parent_id: commentId });
                        } catch (e) { console.log(e) }
                    }

                    if (rule.action === 'lock') {
                        lockPost({ locked: true, post_id: postId });
                        console.log(`Received lock request in c/${communityName} by ${userName}`);

                    } else if (rule.action === 'pin') {
                        featurePost({ feature_type: 'Community', featured: true, post_id: postId });
                        console.log(`Received pin request in c/${communityName} by ${userName}`);

                    }

                    break;
                }
            }

            preventReprocess();
        },

        comment: async ({
            commentView: {
                comment: { id, content: body },
                community: { id: communityId, name: communityName },
                post: { id: postId },
                creator: { actor_id: actorId, id: personId }
            },
            botActions: { createComment, removeComment, isCommunityMod },
            preventReprocess
        }) => {
            if (actorId === OWN_ACTOR_ID) return;
            const isPosterMod = await isCommunityMod({ community_id: communityId, person_id: personId });
            const rules = getCommentRules(db, actorId, communityId, isPosterMod);

            for (const rule of rules) {
                if (rule.type === 'exact' && body.includes(rule.match as string)) {
                    removeComment({ comment_id: id, reason: rule.removal_reason !== null ? rule.removal_reason : undefined });

                    if (rule.message !== null) {
                        createComment({ post_id: postId, content: rule.message, parent_id: id });
                    }

                    console.log(`Removing comment in c/${communityName} by ${actorId}. Reason: ${rule.removal_reason}`);

                    break;
                } else if (rule.type === 'regex' && new RegExp(rule.match).test(body)) {
                    removeComment({ comment_id: id, reason: rule.removal_reason !== null ? rule.removal_reason : undefined });

                    if (rule.message !== null) {
                        createComment({ post_id: postId, content: rule.message, parent_id: id });
                    }

                    console.log(`Removing comment in c/${communityName} by ${actorId}. Reason: ${rule.removal_reason}`);

                    break;
                }
            }

            preventReprocess();
        },

        post: async ({
            postView: {
                post: { id, body, name: title, url },
                community: { id: communityId, name: communityName },
                creator: { actor_id: actorId, id: personId }
            },
            botActions: { createComment, removePost, isCommunityMod },
            preventReprocess
        }) => {
            if (actorId === OWN_ACTOR_ID) return;
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
                        if (rule.message !== null) {
                            await createComment({ post_id: id, content: rule.message });
                        }

                        removePost({ post_id: id, reason: rule.removal_reason !== null ? rule.removal_reason : undefined });

                        console.log(`Removing post in c/${communityName} by ${actorId}. Reason: ${rule.removal_reason}`);

                        break;
                    } else if (rule.type === 'regex' && new RegExp(rule.match).test(field)) {
                        if (rule.message !== null) {
                            await createComment({ post_id: id, content: rule.message });
                        }

                        removePost({ post_id: id, reason: rule.removal_reason !== null ? rule.removal_reason : undefined });

                        console.log(`Removing post in c/${communityName} by ${actorId}. Reason: ${rule.removal_reason}`);

                        break;
                    }
                }
            }

            preventReprocess();
        },

        //This doesn't work

        // commentReport: async ({
        //     reportView: { creator: reportCreator, comment_creator: commentCreator, comment_report: report, community },
        //     botActions: { resolveCommentReport },
        //     preventReprocess
        // }) => {
        //     const whitelisted = isWhitelisted(db, commentCreator.actor_id, community.id);

        //     if (whitelisted) {
        //         await resolveCommentReport(report.id);

        //         console.log(`Resolving report to comment by whitelisted user ${commentCreator.actor_id} in c/${community.name}. Reported by ${reportCreator.actor_id}`);
        //     }

        //     preventReprocess();
        // },

        // postReport: async ({
        //     reportView: { creator: reportCreator, post_creator: postCreator, post_report: report, community },
        //     botActions: { resolvePostReport },
        //     preventReprocess
        // }) => {
        //     const whitelisted = isWhitelisted(db, postCreator.actor_id, community.id);

        //     if (whitelisted) {
        //         await resolvePostReport(report.id);

        //         console.log(`Resolving report to post by whitelisted user ${postCreator.actor_id} in c/${community.name}. Reported by ${reportCreator.actor_id}`);
        //     }

        //     preventReprocess();
        // },
    },
});

setUpDb(db);
bot.start();