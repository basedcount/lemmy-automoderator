import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { Comment, Mention } from './db'

// Load schemas
import postSchema from './schemas/post.json';
import commentSchema from './schemas/comment.json';
import mentionSchema from './schemas/mention.json';
import exceptionSchema from './schemas/exception.json';

// Parses a JSON document against the known schemas, returns the apropriate object
export function parse(data: string): Array<PostJson | CommentJson | MentionJson | ExceptionJson | null> {
    const ajv = new Ajv();
    addFormats(ajv);

    const validatePost = ajv.compile(postSchema);
    const validateComment = ajv.compile(commentSchema);
    const validateMention = ajv.compile(mentionSchema);
    const validateException = ajv.compile(exceptionSchema);

    const jsonData = JSON.parse(data) as any | any[];

    if (Array.isArray(jsonData)) {
        const output = new Array<PostJson | CommentJson | MentionJson | ExceptionJson | null>();

        for (const rule of jsonData) {
            output.push(validate(rule, validatePost, validateComment, validateMention, validateException));
        }

        return output;

    } else {
        return [validate(jsonData, validatePost, validateComment, validateMention, validateException)];

    }
}

// Validate a single JSON rule, return the parsed object or an error if the schema doesn't match
function validate(data: any, validatePost: ValidateFunction, validateComment: ValidateFunction, validateMention: ValidateFunction, validateException: ValidateFunction): PostJson | CommentJson | MentionJson | ExceptionJson | null {
    if (validatePost(data)) {
        return data as unknown as PostJson;

    } else if (validateComment(data)) {
        return data as unknown as CommentJson;

    } else if (validateMention(data)) {
        return data as unknown as MentionJson;

    } else if (validateException(data)) {
        return data as unknown as ExceptionJson;

    } else {
        return null;

    }
}

export interface PostJson {
    rule: "post"
    community: string
    field: "title" | "body" | "link" | "title+body" | "title+link" | "body+title" | "body+link" | "link+title" | "link+body" | "title+body+link" | "title+link+body" | "body+title+link" | "body+link+title" | "link+title+body" | "link+body+title"
    match: string
    type: "exact" | "regex"
    whitelist_exempt: boolean
    mod_exempt: boolean
    message: string | null
    removal_reason: string | null
}

export interface CommentJson extends Comment {
    rule: "comment"
    community: string
    match: string
    type: "exact" | "regex"
    whitelist_exempt: boolean
    mod_exempt: boolean
    message: string | null
    removal_reason: string | null
}

export interface MentionJson extends Mention {
    rule: "mention"
    command: string
    action: "pin" | "lock"
    community: string
    message: string | null
}

export interface ExceptionJson {
    rule: "exception"
    community: string
    user_actor_id: string
}
