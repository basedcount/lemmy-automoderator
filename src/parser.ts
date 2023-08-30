import Ajv from 'ajv';
import addFormats from 'ajv-formats';

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
        console.log('Post');
        return jsonData as unknown as Post;

    } else if (validateComment(jsonData)) {
        console.log('Comment');
        return jsonData as unknown as Comment;

    } else if (validateMention(jsonData)) {
        console.log('Mention');
        return jsonData as unknown as Mention;

    } else if (validateException(jsonData)) {
        console.log('Exception');
        return jsonData as unknown as Exception;

    } else {
        throw new Error('invalid_schema');

    }
}

export interface Post {
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

export interface Comment {
    rule: "comment"
    community: string
    match: string
    type: "exact" | "regex"
    whitelist: boolean
    mod_exempt: boolean
    message: string | null
    removal_reason: string | null
}

export interface Mention {
    rule: "mention"
    command: string | null
    action: "pin" | "lock"
    community: string
    message: string | null
}

export interface Exception {
    rule: "exception"
    community: string
    user_name: string
}

