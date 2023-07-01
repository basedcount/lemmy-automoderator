import LemmyBot from 'lemmy-bot';
import 'dotenv/config'

// DOCS: https://github.com/SleeplessOne1917/lemmy-bot#lemmybotoptions
// DISCUSSION: https://github.com/LemmyNet/lemmy/issues/3281

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
        comment: async ({
            commentView: {
                comment: { id: commentId, content: commentText },
                creator: { id: userId, name: userName },
                post: {id: postId, name: postTitle }
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
    dbFile: 'db.sqlite3',    //Path for the SQLite DB. Used by the bot's lib internally  
});

bot.start();