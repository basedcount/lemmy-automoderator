import LemmyBot from 'lemmy-bot';
import 'dotenv/config'

const bot = new LemmyBot({
    credentials: {
        username: process.env.LEMMY_USERNAME || '',
        password: process.env.LEMMY_PASSWORD || '',
    },
    instance: 'forum.basedcount.com',
    connection: {
        secondsBetweenPolls: 2,
    },
    federation: 'local',    //Do not access content outside of the local server
    handlers: {
        comment: ({
            commentView: {
                comment: { content },
                creator: { name }
            },
            // botActions: {  }
        }) => {
            console.log(`${name} says: "${content}"`);
        },
    },
    dbFile: 'db.sqlite3',    //Path for the SQLite DB. Used by the bot's lib internally  
});

bot.start();