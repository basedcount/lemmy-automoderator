import { Database } from 'better-sqlite3';
import { parse } from './parser';

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
        reason              TEXT,
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
        reason              TEXT,
        PRIMARY KEY(match, type, community_id),
        FOREIGN KEY(community_id) REFERENCES automod_community(id)
    );`;
    //action(pin/lock), message can be null
    const mentionQuery = `
    CREATE TABLE IF NOT EXISTS automod_mention (
        command         TEXT,
        action          TEXT NOT NULL,
        community_id    INTEGER NOT NULL,
        message         TEXT,
        PRIMARY KEY(command, action, community_id),
        FOREIGN KEY(community_id) REFERENCES automod_community(id)
    );`;

    const exceptionQuery = `
    CREATE TABLE IF NOT EXISTS automod_exception (
        user_name       TEXT,
        community_id    INTEGER,
        PRIMARY KEY(user_name, type, community_id),
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
}

//Parse YAML and update the database configuration for the community - TODO
export async function updateCommunityConfig(id: number, configText: string) {
    console.log('Updating community number', id, 'with the following config:');

    await parse(configText);
}
