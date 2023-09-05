import { Database } from 'better-sqlite3';
import type { PostJson, CommentJson, MentionJson, ExceptionJson } from './parser';

//Run the query creation tables if it's the first time the bot is being ran
export function setUpDb(db: Database) {
    const commQuery = `
    CREATE TABLE IF NOT EXISTS automod_community (
        id              INTEGER PRIMARY KEY,
        name            TEXT,
        community_id    NUMBER
    );`;
    //field: (title, body, link), type(regex/exact), whitelist (bool, false by default), mod_exempt(bool, true by default), message can be null, removal reason (posted in modlog) can be null
    const postQuery = `
    CREATE TABLE IF NOT EXISTS automod_post (
        field               TEXT,   
        match               TEXT,
        type                TEXT,
        community_id        INTEGER,
        whitelist_exempt    INTEGER NOT NULL,
        mod_exempt          INTEGER NOT NULL,
        message             TEXT,
        removal_reason      TEXT,
        PRIMARY KEY(field, match, community_id),
        FOREIGN KEY(community_id) REFERENCES automod_community(id)
    );`;
    //type(regex/exact), whitelist (bool, false by default), mod_exempt(bool, true by default), message can be null, removal reason (posted in modlog) can be null
    const commentQuery = `
    CREATE TABLE IF NOT EXISTS automod_comment (
        match               TEXT,
        type                TEXT,
        community_id        INTEGER,
        whitelist_exempt    INTEGER NOT NULL,
        mod_exempt          INTEGER NOT NULL,
        message             TEXT,
        removal_reason      TEXT,
        PRIMARY KEY(match, type, community_id),
        FOREIGN KEY(community_id) REFERENCES automod_community(id)
    );`;
    //action(pin/lock), message can be null
    const mentionQuery = `
    CREATE TABLE IF NOT EXISTS automod_mention (
        command         TEXT NOT NULL,
        action          TEXT NOT NULL,
        community_id    INTEGER NOT NULL,
        message         TEXT,
        PRIMARY KEY(command, action, community_id),
        FOREIGN KEY(community_id) REFERENCES automod_community(id)
    );`;

    const exceptionQuery = `
    CREATE TABLE IF NOT EXISTS automod_exception (
        user_actor_id     TEXT,
        community_id    INTEGER,
        PRIMARY KEY(user_actor_id, community_id),
        FOREIGN KEY(community_id) REFERENCES automod_community(id)
    );`;

    db.prepare(commQuery).run();
    db.prepare(postQuery).run();
    db.prepare(commentQuery).run();
    db.prepare(mentionQuery).run();
    db.prepare(exceptionQuery).run();
}

//Get an internal id from a community name and a community id
//I am using a dedicated internal id because I'm not sure if the provided "community_id" is unique
export function getCommunity(db: Database, name: string, community_id: number): number | null {
    const query = db.prepare(`SELECT id FROM automod_community WHERE name = ? AND community_id = ?`);
    const res = query.get(name, community_id) as { id: number } | undefined;

    if (res !== undefined) return res.id

    return null;
}

//Inserts a new community in the database
export function addCommunity(db: Database, name: string, id: number) {
    const query = db.prepare(`INSERT INTO automod_community (name, community_id) VALUES (?, ?)`);
    query.run(name, id);

    return getCommunity(db, name, id) as number;
}

/*  CONFIGURATION SETTERS  */

export function addPostRule(db: Database, rule: PostJson, community: number) {
    const rules = new Array<PostJson>();

    if (rule.field.includes('+')) { //Multiple fields, separated by + sign
        const fields = rule.field.split('+') as Array<"title" | "body" | "link">;

        for (const tmp of fields) {
            const field = tmp as "title" | "body" | "link";     //TS workaround
            console.log(tmp, field)

            rules.push({
                rule: 'post',
                field: field,
                community: rule.community,
                match: rule.match,
                message: rule.message,
                mod_exempt: rule.mod_exempt,
                removal_reason: rule.removal_reason,
                type: rule.type,
                whitelist_exempt: rule.whitelist_exempt,
            })
        }
    } else {    //Single field
        rules.push(rule);
    }

    for (const rule of rules) {
        const query = db.prepare(`INSERT INTO automod_post (field,match,type,community_id,whitelist_exempt,mod_exempt,message,removal_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

        query.run(rule.field, rule.match, rule.type, community, bool2int(rule.whitelist_exempt), bool2int(rule.mod_exempt), rule.message, rule.removal_reason);
    }
}

export function addCommentRule(db: Database, rule: CommentJson, community: number) {
    const query = db.prepare(`INSERT INTO automod_comment (match,type,community_id,whitelist_exempt,mod_exempt,message,removal_reason) VALUES (?, ?, ?, ?, ?, ?, ?)`);

    query.run(rule.match, rule.type, community, bool2int(rule.whitelist_exempt), bool2int(rule.mod_exempt), rule.message, rule.removal_reason);
}

export function addMentionRule(db: Database, rule: MentionJson, community: number) {
    const query = db.prepare(`INSERT INTO automod_mention (command,action,community_id,message) VALUES (?, ?, ?, ?)`);

    query.run(rule.command, rule.action, community, rule.message);
}

export function addExceptionRule(db: Database, rule: ExceptionJson, community: number) {
    const query = db.prepare(`INSERT INTO automod_exception (user_actor_id,community_id) VALUES (?, ?)`);

    query.run(rule.user_actor_id, community);
}

/*  CONFIGURATION GETTERS  */

//Whitelist exceptions and moderator exceptions are handled by this function. The caller only has to pass the correct actor_id and the result of an isCommunityModerator() function
export function getPostRules(db: Database, actorId: string, community: number, isModerator: boolean) {
    let query;

    if (isModerator) {
        query = db.prepare(`
        SELECT field, match, type, message, removal_reason
        FROM automod_post
        INNER JOIN automod_community ON automod_post.community_id = automod_community.id
        WHERE automod_community.community_id = ?
        AND automod_post.mod_exempt = 0
        AND (
            CASE
                WHEN ? IN (
                    SELECT user_actor_id
                    FROM automod_exception
                    WHERE community_id = automod_post.community_id
                )
                THEN automod_post.whitelist_exempt = 0
                ELSE 1
            END
        )
        `);
    } else {
        query = db.prepare(`
        SELECT field, match, type, message, removal_reason
        FROM automod_post
        INNER JOIN automod_community ON automod_post.community_id = automod_community.id
        WHERE automod_community.community_id = ?
        AND (
            CASE
                WHEN ? IN (
                    SELECT user_actor_id
                    FROM automod_exception
                    WHERE community_id = automod_post.community_id
                )
                THEN automod_post.whitelist_exempt = 0
                ELSE 1
            END
        )
        `);
    }

    return query.all(community, actorId) as Post[];
}

//Whitelist exceptions and moderator exceptions are handled by this function. The caller only has to pass the correct actor_id and the result of an isCommunityModerator() function
export function getCommentRules(db: Database, actorId: string, community: number, isModerator: boolean) {
    let query;

    if (isModerator) {
        query = db.prepare(`
        SELECT match, type, message, removal_reason
        FROM automod_comment
        INNER JOIN automod_community ON automod_comment.community_id = automod_community.id
        WHERE automod_community.community_id = ?
        AND automod_comment.mod_exempt = 0
        AND (
            CASE
                WHEN ? IN (
                    SELECT user_actor_id
                    FROM automod_exception
                    WHERE community_id = automod_comment.community_id
                )
                THEN automod_comment.whitelist_exempt = 0
                ELSE 1
            END
        )        
        `);
    } else {
        query = db.prepare(`
        SELECT match, type, message, removal_reason
        FROM automod_comment
        INNER JOIN automod_community ON automod_comment.community_id = automod_community.id
        WHERE automod_community.community_id = ?
        AND (
            CASE
                WHEN ? IN (
                    SELECT user_actor_id
                    FROM automod_exception
                    WHERE community_id = automod_comment.community_id
                )
                THEN automod_comment.whitelist_exempt = 0
                ELSE 1
            END
        )
        `);
    }

    return query.all(community, actorId) as Comment[];
}

export function getMentionRules(db: Database, community: number) {
    const query = db.prepare(`
    SELECT command, action, message
    FROM automod_mention
    INNER JOIN automod_community ON automod_mention.community_id = automod_community.id
    WHERE automod_community.community_id = ?
    `);

    return query.all(community) as Mention[];
}

//Checks whether a user is whitelisted for a certain community
export function isWhitelisted(db: Database, actorId: string, community: number) {
    const query = db.prepare(`
    SELECT user_actor_id
    FROM automod_exception
    INNER JOIN automod_community ON automod_exception.community_id = automod_community.id
    WHERE automod_community.id = ?
    `);

    const users = query.all(community) as { user_actor_id: string }[];

    for (const user of users) {
        if (user.user_actor_id === actorId) return true;
    }

    return false;
}

/*  UTILITY  */

//false -> 0; true -> 1. Just Javascript being Javascript
function bool2int(value: boolean) {
    return value as unknown as number + 0;
}

/*  TYPES  */

export interface Post {
    field: "title" | "body" | "link"
    match: string | RegExp
    type: "exact" | "regex"
    message: string | null
    removal_reason: string | null
}

export interface Comment {
    match: string | RegExp
    type: "exact" | "regex"
    message: string | null
    removal_reason: string | null
}

export interface Mention {
    command: string
    action: "pin" | "lock"
    message: string | null
}