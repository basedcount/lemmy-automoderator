# SPECS

What the bot needs to do.

## Discussion
https://github.com/LemmyNet/lemmy/issues/3281

## API docs
https://github.com/SleeplessOne1917/lemmy-bot#lemmybotoptions

https://github.com/LemmyNet/lemmy-js-client
https://join-lemmy.org/api/classes/LemmyHttp.html

## Configuration
mod writes private message, check if writer is mod, then accept config. Store in local sqlite database. If already saved, rewrite (drop existing, save new)
## Actions
- mods can comment under post to remove, lock, pin
- count the reports, remove after N reports
- send "modmail": a private message to all moderators
- reply to posts and comments (removal reason, post locked)
- handle reports: automatically resolve reports for "whitelisted users", eg: bots, other mods, admins, ecc...
- auto remove posts and comments depending on title / body / author's name contents
- auto remove posts with links to blacklisted sites
- automatically ban from community if from a "blacklisted" instance, if name matches REGEX...


## Additional notes
- All regex checks should have a blacklist mode (default) and a white list one (remove if it doesn't match the REGEX)