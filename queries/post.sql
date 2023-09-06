-- If the user is not a mod:

SELECT field, match, type, message, reason
FROM automod_post
INNER JOIN automod_community ON automod_post.community_id = automod_community.id
WHERE automod_community.community_id = 3
AND (
    CASE
        WHEN 'Nerd02' IN (
            SELECT user_actor_id
            FROM automod_exception
            WHERE community_id = automod_post.community_id
        )
        THEN automod_post.whitelist_exempt = 0
        ELSE 1
    END
)

-- If the user is a mod:

SELECT field, match, type, message, reason
FROM automod_post
INNER JOIN automod_community ON automod_post.community_id = automod_community.id
WHERE automod_community.community_id = 3
AND automod_post.mod_exempt = 0
AND (
    CASE
        WHEN 'Nerd02' IN (
            SELECT user_actor_id
            FROM automod_exception
            WHERE community_id = automod_post.community_id
        )
        THEN automod_post.whitelist_exempt = 0
        ELSE 1
    END
)
