# Feature overview
## Moderation

- **Automated removal**
  - of **posts**, based on their _titles_, _content_ or _link_
  - of **comments**, based on their _content_
  - configurable with either regular expressions or substrings
- **User whitelisting** and **exceptions for moderators** to selectively lift some or all of the aforementioned rules.
- Mention based **pinning** and **locking** of a post, through commands available exclusively to the mod team

At the moment the AutoMod works solely on local communities. Support for federated communities might be added in future updates.

## Administration

Optionally, the AutoMod may be appointed as an administrator in an instance. This will offer an additional feature:
- Discord notifications for new **registration applications** through a webhook.

# Installation
There are three possible installation methods:
- [Docker with docker-compose](https://github.com/ornato-t/lemmy-automoderator/wiki/Installation#lemmy-deployed-on-docker-with-docker-compose) (recommended)
- [Docker as a standalone container](https://github.com/ornato-t/lemmy-automoderator/wiki/Installation#standalone-docker-container)
- [Node script](https://github.com/ornato-t/lemmy-automoderator/wiki/Installation#node-script)

The repository's wiki includes a brief guide on how to set up all of these deployments.

# Configuration
Once the AutoMod has been correctly installed on an instance, moderators will be able to add their custom configurations and rules.

Configuration is done through direct messages between a moderator's account and the AutoMod's.  
AutoMod rules should be in the JSON format and follow the provided [schemas](https://github.com/ornato-t/lemmy-automoderator/tree/master/src/schemas). 

More detailed documentation on how to configure the AutoMod may be found in this repository's [wiki](https://github.com/ornato-t/lemmy-automoderator/wiki).

# Roadmap
Eventually, these features will be added to the AutoMod:
- Automated resolving of reports for posts and comments created by whitelisted users.

# Feature request
If you have any ideas for additional features that you'd like to see in this bot, feel free to open an issue detailing your request.