


/*********************
 * GENERIC UTILITIES *
 *********************/

export const camelCase = (...terms:string[]) => terms.filter(term => term !== undefined && term !== '')
    .map((term:string) => { 
        let newTerm = term.replace(/\s+/g, ''); 
        return newTerm.charAt(0).toUpperCase() + newTerm.slice(1);
    })
    .join('')
    .replace(/^\w/, firstCharacter => firstCharacter.toLowerCase());

export const isEnumValue = <T,>(enumObj: T, value: any): value is T[keyof T] => Object.values(enumObj).includes(value as T[keyof T]);
    
export const isURLValid = (url: string): boolean => {
    try { new URL(url); return true; } catch { return false; }
};
      
export const extractRegexMaxLength = (regex:RegExp, findMin?:boolean):number => {
    const match = regex.toString().match(/\^\.\{(\d+),(\d+)\}\$/);
    return match ? 
        (findMin ? parseInt(match[1], 10) : parseInt(match[2], 10)) 
        : (findMin ? 0 : Number.MAX_SAFE_INTEGER);
}
