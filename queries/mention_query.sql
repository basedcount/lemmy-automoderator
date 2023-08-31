SELECT command, action, message
FROM automod_mention
INNER JOIN automod_community ON automod_mention.community_id = automod_community.id
WHERE automod_community.community_id = 3
