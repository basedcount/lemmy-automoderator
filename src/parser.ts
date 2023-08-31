import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { Post, Comment, Mention } from './db'

// Load schemas
import postSchema from './schemas/post.json';
import commentSchema from './schemas/comment.json';
import mentionSchema from './schemas/mention.json';
import exceptionSchema from './schemas/exception.json';

// Parses a JSON document against the known schemas, returns the apropriate object
export function parse(data: string) {
    const ajv = new Ajv();
    addFormats(ajv);

    const validatePost = ajv.compile(postSchema);
    const validateComment = ajv.compile(commentSchema);
    const validateMention = ajv.compile(mentionSchema);
    const validateException = ajv.compile(exceptionSchema);

    const jsonData = JSON.parse(data);

    if (validatePost(jsonData)) {
        return jsonData as unknown as PostJson;

    } else if (validateComment(jsonData)) {
        return jsonData as unknown as CommentJson;

    } else if (validateMention(jsonData)) {
        return jsonData as unknown as MentionJson;

    } else if (validateException(jsonData)) {
        return jsonData as unknown as ExceptionJson;

    } else {
        throw new Error('invalid_schema');

    }
}

export interface PostJson extends Post {
    rule: "post"
    community: string
    field: "title" | "body" | "link"
    match: string
    type: "exact" | "regex"
    whitelist: boolean
    mod_exempt: boolean
    message: string | null
    removal_reason: string | null
}

export interface CommentJson extends Comment {
    rule: "comment"
    community: string
    match: string
    type: "exact" | "regex"
    whitelist: boolean
    mod_exempt: boolean
    message: string | null
    removal_reason: string | null
}

export interface MentionJson extends Mention {
    rule: "mention"
    command: string | null
    action: "pin" | "lock"
    community: string
    message: string | null
}

export interface ExceptionJson {
    rule: "exception"
    community: string
    user_actor_id: string
}
