# An AutoMod bot for Lemmy

# Feature overview
## Moderation

Once the AutoMod has been appointed as a moderator, it offers the following features:
- **Automated removal** of posts (based on titles, bodies and linked URLs) and comments, supporting both:
  - Regex: for more granular control.
  - Substring: for less experienced users.
- **User whitelisting** and **exceptions for moderators** to selectively lift some or all of the aforementioned rules.
- Mention based **pin** and **lock** commands for the mod team
  - Other moderators will be able to mention the bot along with a custom command to either _pin a post to the community_ or _lock its comment section_, to allow full access to the mod toolbox and quick intervention to moderators using limited clients, such as mobile applications.

At the moment the AutoMod works exclusively with local communities. Support for federated communities might be added in future updates.

## Administration

Optionally, the AutoMod may be appointed as an administrator in an instance. This will offer an additional feature:
- Discord notifications for new **registration applications** through a webhook.

_NOTE: this feature requires a Discord server where the configuring user has administration permissions._

# Configuration
Once the AutoMod has been correctly installed on an instance, moderators will be able to add their custom configurations.

Configuration is done through direct messages from a moderator to the AutoMod's account. AutoMod rules should be in the JSON format and follow the provided [schemas](https://github.com/ornato-t/lemmy-automoderator/tree/master/src/schemas). 

More detailed documentation on how to configure the AutoMod may be found in this repository's [wiki](https://github.com/ornato-t/lemmy-automoderator/wiki).

# Installation
## Docker (recommended method)
### Lemmy deployed on Docker with `docker-compose`

Add the following lines to your `docker-compose.yml`, as an additional voice under the `services` key:

```yml
 automod:
    image: ornatot/lemmy-automoderator:latest
    hostname: automod
    environment:
      - LEMMY_USERNAME=AccountUsername
      - LEMMY_PASSWORD=AccountPassword
      - LEMMY_INSTANCE=lemmy.example.com
      - DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/[...]
    restart: always
    logging: *default-logging
    ports:
      - "8000:8080"
    volumes:
      - ./volumes/automoderator:/usr/src/app/database
```

The `environment` values will have to be filled with the credentials of the account you'll be using the AutoMod from, as well as your Lemmy instance.  
The `DISCORD_WEBHOOK_URL` is optional and only necessary if you plan on using the [Discord webhook](#administration) administration feature.

### Standalone Docker container

Alternatively, it is also possible to run the docker container without docker-compose, by running the following command:
```sh
$ docker run 
    -p PORT:8080 
    -e LEMMY_USERNAME=AccountUsername 
    -e LEMMY_PASSWORD=AccountPassword
    -e LEMMY_INSTANCE=lemmy.example.com
    -e DISCORD_WEBHOOK_URL=https://discord.com/api/[...]
    -d ornatot/lemmy-automoderator
```
The `-e` values will have to be filled with the credentials of the account you'll be using the AutoMod from, as well as your Lemmy instance.  
The `DISCORD_WEBHOOK_URL` is optional and only necessary if you plan on using the [Discord webhook](#administration) administration feature.

Users will also need to change the value of `PORT` to an appropriate port number on the host machine.

## Node script
Lastly, it is possible to directly run the bot as a Node.js script.

### Requirements
- Node.JS on a version greater than 17.5. Reccomended version: 18.17.1 LTS
- NPM
  
### Credentials
To run the bot, it will be necessary to create a `.env` file in the root directory of the project, containing the credentials of the account you'll be using the AutoMod from, as well as your Lemmy instance.  
The `DISCORD_WEBHOOK_URL` is optional and only necessary if you plan on using the [Discord webhook](#administration) administration feature.

```env
LEMMY_USERNAME=AccountUsername
LEMMY_PASSWORD=AccountPassword
LEMMY_INSTANCE=lemmy.example.com
DISCORD_WEBHOOK_URL=https://discord.com/api/[...]
```

### Commands
Run the following commands to compile and run the bot:

`npm i` to install all dependencies. It might be necessary to also run separately `npm i better-sqlite3`, to install the appropriate sqlite binaries for your machine.

`npm run build` to compile the TypeScript code to executable JavaScript.

`npm start` to start the bot.

# Feature request and roadmap
## Roadmap
Eventually, these features will be added to the AutoMod:
- Automated resolving of reports for posts and comments created by whitelisted users.

## Feature request
If you have any ideas for additional features that you'd like to see in this bot, feel free to open an issue detailing your request.