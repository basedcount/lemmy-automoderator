import { readFileSync } from 'fs'; //TEMP

/*
    TODO:
    - acquire JSON (fs for testing, then string message)
    - parse JSON
    - check schema
    - return TS mapped object

    - write a schema
    - write TS interfaces
*/

export function parse(data: string) {
    data = temp();
    
    const res = JSON.parse(data);

    console.log(res);
}

function temp(): string {
    return readFileSync('./automod.json', { encoding: 'utf-8' });
}
